// Wire shapes from contracts/openapi.yaml (components.schemas). Do not extend them here.

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserEnvelope {
  user: User;
}

export interface FieldDetail {
  field: string;
  messages: string[];
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
  details?: FieldDetail[];
}
