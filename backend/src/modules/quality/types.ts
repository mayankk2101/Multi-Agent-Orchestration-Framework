export interface CreateQualityVerificationRequest {
  assignment_id: string;
  score: number; // 0-100
  notes?: string;
}

export interface CreateRatingRequest {
  assignment_id: string;
  worker_id: string;
  score: number; // 1-5
  comment?: string;
  criteria_scores?: Record<string, number>;
}
