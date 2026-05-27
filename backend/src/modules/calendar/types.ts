export interface DailyOperation {
  id: string;
  date: string;
  room_count: number;
  checkout_count: number;
  stay_over_count: number;
  notes?: string;
}
