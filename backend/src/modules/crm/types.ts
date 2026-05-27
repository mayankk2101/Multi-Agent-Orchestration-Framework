export interface CreateHotelRequest {
  name: string;
  city: string;
  address: string;
  timezone?: string;
}

export interface CreateRoomRequest {
  number: string;
  type: 'single' | 'double' | 'suite';
}

export interface CreateTaskRequest {
  room_id: string;
  assigned_to_worker_id: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
}
