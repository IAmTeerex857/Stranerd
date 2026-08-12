import type { Request, Response } from 'express'
import { appBaseUrl, bachsCatalog, bachsRequest, billingCatalog, billingCountry, billingErrorResponse, billingQuantity, billingRails, buildBachsCheckoutPayload, getBillingClient, requireBillingUser, spotflowRequest, validateBachsCheckoutUrl, type BillingProductId, type BillingRail } from '../../server/billing.js'

export default async function handler(request: Request, response: Response) {
  const country = billingCountry(request.headers)
  if (request.method === 'GET') {
    response.setHeader('Cache-Control', 'private, no-store')
    response.json({ country, rails: { subscription: billingRails(country, 'subscription'), payg_100: billingRails(country, 'payg_100') } })
    return
  }
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    const user = await requireBillingUser(request.headers.authorization)
    const productId = request.body?.productId as BillingProductId
    const rail = (request.body?.rail || 'ngn') as BillingRail
    if (!['ngn', 'usd_card', 'stablecoin'].includes(rail)) {
      response.status(400).json({ error: 'invalid_rail', message: 'Select a valid payment rail.' })
      return
    }
    if (!billingCatalog[productId]) {
      response.status(400).json({ error: 'invalid_product', message: 'Select a valid Stranerd billing product.' })
      return
    }
    const quantity = billingQuantity(productId, request.body?.quantity)
    if (!billingRails(country, productId).includes(rail)) {
      response.status(400).json({ error: 'rail_not_available', message: 'This payment method is not available in your region.' })
      return
    }
    if (rail !== 'ngn') {
      await createBachsCheckout(response, user, productId, rail, quantity)
      return
    }
    const product = billingCatalog[productId]
    if (productId === 'subscription' && !process.env.SPOTFLOW_PLUS_PLAN_ID) {
      response.status(503).json({ error: 'plan_not_configured', message: 'The Stranerd Plus plan is not configured.' })
      return
    }

    const client = getBillingClient()
    const paymentIntentId = crypto.randomUUID()
    const providerReference = `stranerd_${productId}_${crypto.randomUUID().replaceAll('-', '')}`
    const { error: intentError } = await client.rpc('create_spotflow_payment_intent', {
      p_id: paymentIntentId,
      p_user_id: user.id,
      p_provider_reference: providerReference,
      p_product_type: product.productType,
      p_amount_minor: product.amountMinor * quantity,
      p_credits: product.credits * quantity,
      p_metadata: { mode: process.env.SPOTFLOW_MODE, quantity },
    })
    if (intentError?.code === '23505' && productId === 'subscription') {
      response.status(409).json({ error: 'checkout_in_progress', message: 'A Stranerd Plus checkout is already pending for this account.' })
      return
    }
    if (intentError) throw intentError

    try {
      const provider = await spotflowRequest('/payments/initialize', {
        method: 'POST',
        headers: { 'Idempotency-Key': providerReference },
        body: JSON.stringify({
          ...(productId === 'payg_100' ? { reference: providerReference } : {}),
          currency: product.currency,
          ...(product.providerAmount ? { amount: product.providerAmount * quantity } : {}),
          ...(productId === 'subscription' ? { planId: process.env.SPOTFLOW_PLUS_PLAN_ID } : {}),
          customer: {
            email: user.email,
            name: user.user_metadata.full_name || user.user_metadata.name || user.email,
          },
          callbackUrl: `${appBaseUrl()}/billing/success?intent=${paymentIntentId}`,
          metadata: {
            productName: 'Stranerd',
            productType: product.productType,
            paymentIntentId,
            userId: user.id,
            quantity,
          },
        }),
      })
      const checkoutUrl = typeof provider.checkoutUrl === 'string' ? provider.checkoutUrl : ''
      const confirmedReference = typeof provider.reference === 'string' ? provider.reference : providerReference
      const checkout = new URL(checkoutUrl)
      if (checkout.protocol !== 'https:' || !/(^|\.)spotflow\.(co|one)$/.test(checkout.hostname)) throw new Error('Spotflow returned an invalid checkout URL.')
      const current = await client.from('payment_intents').select('metadata').eq('id', paymentIntentId).single()
      if (current.error) throw current.error
      const { error: updateError } = await client.from('payment_intents').update({ provider_reference: confirmedReference, checkout_url: checkoutUrl, metadata: { ...(current.data.metadata as Record<string, unknown>), mode: provider.mode || 'TEST', paymentCode: provider.paymentCode } }).eq('id', paymentIntentId)
      if (updateError) throw updateError
      response.json({ checkoutUrl, paymentIntentId })
    } catch (error) {
      const current = await client.from('payment_intents').select('metadata').eq('id', paymentIntentId).single()
      await client.from('payment_intents').update({ status: 'failed', metadata: { ...((current.data?.metadata || {}) as Record<string, unknown>), initializationFailed: true } }).eq('id', paymentIntentId)
      throw error
    }
  } catch (error) {
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

async function createBachsCheckout(response: Response, user: Awaited<ReturnType<typeof requireBillingUser>>, productId: BillingProductId, rail: Exclude<BillingRail, 'ngn'>, quantity: number) {
  if (productId === 'subscription' && rail === 'stablecoin') {
    response.status(400).json({ error: 'invalid_rail', message: 'Subscriptions require USD card checkout.' })
    return
  }
  const product = bachsCatalog[productId]
  const client = getBillingClient()
  const paymentIntentId = crypto.randomUUID()
  const providerReference = paymentIntentId
  const { error: intentError } = await client.rpc('create_billing_payment_intent', {
    p_id: paymentIntentId,
    p_user_id: user.id,
    p_provider: 'bachs',
    p_provider_reference: providerReference,
    p_product_type: product.productType,
    p_amount_minor: product.amountMinor * quantity,
    p_currency: product.currency,
    p_credits: product.credits * quantity,
    p_metadata: { mode: process.env.BACHS_MODE, rail, quantity, bachsProductId: productId === 'subscription' ? process.env.BACHS_PLUS_PRODUCT_ID : null },
  })
  if (intentError?.code === '23505' && productId === 'subscription') {
    response.status(409).json({ error: 'checkout_in_progress', message: 'A Stranerd Plus checkout is already pending for this account.' })
    return
  }
  if (intentError) throw intentError

  try {
    const payload = buildBachsCheckoutPayload({
      productId,
      rail,
      paymentIntentId,
      reference: providerReference,
      userId: user.id,
      email: user.email || '',
      name: user.user_metadata.full_name || user.user_metadata.name || user.email || 'Stranerd customer',
      plusProductId: process.env.BACHS_PLUS_PRODUCT_ID,
      baseUrl: appBaseUrl(),
      quantity,
    })
    const provider = await bachsRequest('/v1/checkout-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': `bachs:${providerReference}` },
      body: JSON.stringify(payload),
    })
    const checkoutUrl = validateBachsCheckoutUrl(provider.checkout_url)
    const current = await client.from('payment_intents').select('metadata').eq('id', paymentIntentId).single()
    if (current.error) throw current.error
    const { error: updateError } = await client.from('payment_intents').update({
      checkout_url: checkoutUrl,
      metadata: { ...(current.data.metadata as Record<string, unknown>), checkoutId: provider.checkout_id, expiresAt: provider.expires_at },
    }).eq('id', paymentIntentId).eq('provider', 'bachs')
    if (updateError) throw updateError
    response.json({ checkoutUrl, paymentIntentId })
  } catch (error) {
    const current = await client.from('payment_intents').select('metadata').eq('id', paymentIntentId).single()
    await client.from('payment_intents').update({ status: 'failed', metadata: { ...((current.data?.metadata || {}) as Record<string, unknown>), initializationFailed: true } }).eq('id', paymentIntentId).eq('provider', 'bachs')
    throw error
  }
}
