export interface CreateWorkRequestRequest {
  hotel_id: string;
  position: string;
  workers_needed: number;
  shift_date: string;
  shift_start_time: string;
  shift_end_time: string;
}

export interface AssignWorkersRequest {
  worker_ids: string[];
}
