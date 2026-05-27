export interface CreateQualityVerificationRequest {
  task_id: string;
  score: number; // 0-100
  notes?: string;
}

export interface CreateRatingRequest {
  worker_id: string;
  score: number; // 0-5
  comment?: string;
}
