import type { Request, Response } from 'express'
import { appBaseUrl, billingCatalog, billingErrorResponse, getBillingClient, requireBillingUser, spotflowRequest, type BillingProductId } from '../../server/billing.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    const user = await requireBillingUser(request.headers.authorization)
    const productId = request.body?.productId as BillingProductId
    const product = billingCatalog[productId]
    if (!product) {
      response.status(400).json({ error: 'invalid_product', message: 'Select a valid Stranerd billing product.' })
      return
    }
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
      p_amount_minor: product.amountMinor,
      p_credits: product.credits,
      p_metadata: { mode: process.env.SPOTFLOW_MODE },
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
          ...(product.providerAmount ? { amount: product.providerAmount } : {}),
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
          },
        }),
      })
      const checkoutUrl = typeof provider.checkoutUrl === 'string' ? provider.checkoutUrl : ''
      const confirmedReference = typeof provider.reference === 'string' ? provider.reference : providerReference
      const checkout = new URL(checkoutUrl)
      if (checkout.protocol !== 'https:' || !/(^|\.)spotflow\.(co|one)$/.test(checkout.hostname)) throw new Error('Spotflow returned an invalid checkout URL.')
      const { error: updateError } = await client.from('payment_intents').update({ provider_reference: confirmedReference, checkout_url: checkoutUrl, metadata: { mode: provider.mode || 'TEST', paymentCode: provider.paymentCode } }).eq('id', paymentIntentId)
      if (updateError) throw updateError
      response.json({ checkoutUrl, paymentIntentId })
    } catch (error) {
      await client.from('payment_intents').update({ status: 'failed', metadata: { initializationFailed: true } }).eq('id', paymentIntentId)
      throw error
    }
  } catch (error) {
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}
