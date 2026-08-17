export interface Config {
  supabaseUrl: string
  supabaseSecretKey: string
  supadataApiKey: string
  azureOpenAiEndpoint: string
  azureOpenAiApiKey: string
  chatDeployment: string
  transcriptionDeployment: string
  azureOpenAiApiVersion: string
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required application setting: ${name}`)
  return value
}

export function loadConfig(): Config {
  return {
    supabaseUrl: required('SUPABASE_URL'),
    supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
    get supadataApiKey() { return required('SUPADATA_API_KEY') },
    get azureOpenAiEndpoint() {
      const endpoint = required('AZURE_OPENAI_ENDPOINT').replace(/\/$/, '')
      if (!endpoint.startsWith('https://')) throw new Error('AZURE_OPENAI_ENDPOINT must use HTTPS')
      return endpoint
    },
    get azureOpenAiApiKey() { return required('AZURE_OPENAI_API_KEY') },
    get chatDeployment() { return required('AZURE_OPENAI_DEPLOYMENT') },
    get transcriptionDeployment() { return required('AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT') },
    azureOpenAiApiVersion: '2025-01-01-preview',
  }
}
