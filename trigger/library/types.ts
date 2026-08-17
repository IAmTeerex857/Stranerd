export type SourceCategory = 'prompt' | 'document' | 'audio' | 'link' | 'youtube'

export interface QueueMessage { jobId: string }

export interface LibraryJob {
  id: string
  set_id: string
  creator_user_id: string
  request_id: string
  reservation_id: string
  target_version: number
  output_type: 'flashcards' | 'practice'
  source_category: SourceCategory
  requested_count: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  attempt_count: number
}

export interface LibrarySource {
  id: string
  job_id: string
  set_id: string
  generation_version: number
  ordinal: number
  category: SourceCategory
  input_text: string | null
  source_url: string | null
  mime_type: string | null
  file_name: string | null
  byte_size: number | null
  storage_path: string | null
}

export interface GeneratedItem {
  kind: 'flashcard' | 'question'
  prompt: string
  answer: string
  explanation: string
  options: string[]
  tags: string[]
}

export interface LibraryItem extends GeneratedItem {
  id: string
  ordinal: number
}
