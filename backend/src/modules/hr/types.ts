export interface CreateContractRequest {
  worker_id: string;
  template_id: string;
  position: string;
  salary_amount: number;
  start_date: string;
  end_date?: string;
}

export interface CreatePayrollRequest {
  worker_id: string;
  pay_period_start: string;
  pay_period_end: string;
  gross_salary: number;
}
