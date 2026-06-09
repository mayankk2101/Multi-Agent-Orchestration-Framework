# Hotel CRM — REST API Specification V1

**Base URL:** `https://api.hotelcrm.com/api/v1`  
**Protocol:** HTTPS only  
**Content-Type:** `application/json`  
**Auth:** `Authorization: Bearer <access_token>`  
**API Version header:** `X-API-Version: 1`

---

## Table of Contents

1. [Conventions](#conventions)
2. [Auth](#1-auth)
3. [Hotels](#2-hotels)
4. [HotelWorker](#3-hotelworker)
5. [WorkRequest](#4-workrequest)
6. [WorkApplication](#5-workapplication)
7. [WorkerAssignment](#6-workerassignment)
8. [Attendance](#7-attendance)
9. [QualityVerification](#8-qualityverification)
10. [Rating](#9-rating)
11. [Notifications](#10-notifications)
12. [Shared Schemas](#shared-schemas)
13. [Error Reference](#error-reference)
14. [Audit Event Reference](#audit-event-reference)
15. [RBAC Matrix](#rbac-matrix)

---

## Conventions

### Response Envelope

**Success:**
```json
{
  "status": "success",
  "data": { },
  "meta": {
    "timestamp": "2026-06-09T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

**Paginated Success:**
```json
{
  "status": "success",
  "data": [ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "total_pages": 8
  },
  "meta": {
    "timestamp": "2026-06-09T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

**Error:**
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format", "value": "bad-email" }
    ]
  },
  "meta": {
    "timestamp": "2026-06-09T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

### Roles

| Role | Code | Description |
|------|------|-------------|
| Admin | `ADMIN` | Full system access |
| Manager | `MANAGER` | Hotel-scoped operations |
| Checker | `CHECKER` | Quality verification & ratings |
| Worker | `WORKER` | Task execution, self-service |

### Pagination Query Parameters

| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `page` | integer | 1 | — |
| `limit` | integer | 20 | 100 |

### ID Format

All IDs are CUID strings (e.g., `clx1abc2def3gh4ij`).

---

## 1. Auth

### POST /auth/signup

Register a new user account.

**RBAC:** Public (no auth required)

**Request DTO:**
```json
{
  "email": "worker@hotel.com",
  "password": "SecurePass123!",
  "first_name": "Maria",
  "last_name": "Schmidt",
  "phone": "+49123456789",
  "role": "WORKER"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `email` | string | ✓ | Valid email, max 255 chars, unique |
| `password` | string | ✓ | Min 8 chars, at least 1 uppercase, 1 digit, 1 special char |
| `first_name` | string | ✓ | 1–100 chars, letters/spaces/hyphens only |
| `last_name` | string | ✓ | 1–100 chars, letters/spaces/hyphens only |
| `phone` | string | — | E.164 format |
| `role` | enum | — | `WORKER` \| `CHECKER`. Default: `WORKER`. MANAGER/ADMIN requires existing ADMIN token |

**Response DTO (201):**
```json
{
  "user": {
    "id": "clx1abc2def3gh4ij",
    "email": "worker@hotel.com",
    "first_name": "Maria",
    "last_name": "Schmidt",
    "role": "WORKER",
    "is_active": true,
    "created_at": "2026-06-09T10:00:00Z"
  },
  "tokens": {
    "access_token": "<jwt>",
    "refresh_token": "<opaque>",
    "expires_in": 3600
  }
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid fields |
| 409 | `RESOURCE_ALREADY_EXISTS` | Email taken |

**Audit Event:** `AUTH.USER_REGISTERED` — actor: new user, resource: User

---

### POST /auth/login

Authenticate and obtain tokens.

**RBAC:** Public

**Request DTO:**
```json
{
  "email": "worker@hotel.com",
  "password": "SecurePass123!"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `email` | string | ✓ | Valid email |
| `password` | string | ✓ | Non-empty |

**Response DTO (200):**
```json
{
  "user": {
    "id": "clx1abc2def3gh4ij",
    "email": "worker@hotel.com",
    "first_name": "Maria",
    "last_name": "Schmidt",
    "role": "WORKER",
    "hotel_ids": [],
    "permissions": [],
    "is_active": true
  },
  "tokens": {
    "access_token": "<jwt>",
    "refresh_token": "<opaque>",
    "expires_in": 3600
  }
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing fields |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `ACCOUNT_DISABLED` | User is_active = false |
| 429 | `RATE_LIMIT_EXCEEDED` | >10 failed attempts / 15 min |

**Audit Event:** `AUTH.LOGIN_SUCCESS` / `AUTH.LOGIN_FAILURE`

---

### POST /auth/refresh

Exchange refresh token for new access token.

**RBAC:** Public (refresh token required)

**Request DTO:**
```json
{
  "refresh_token": "<opaque>"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `refresh_token` | string | ✓ | Non-empty |

**Response DTO (200):**
```json
{
  "tokens": {
    "access_token": "<jwt>",
    "refresh_token": "<opaque>",
    "expires_in": 3600
  }
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | `TOKEN_INVALID` | Unknown or used refresh token |
| 401 | `TOKEN_EXPIRED` | Session expired (7 days) |

**Audit Event:** `AUTH.TOKEN_REFRESHED`

---

### POST /auth/logout

Revoke current session.

**RBAC:** Any authenticated user

**Request DTO:**
```json
{
  "refresh_token": "<opaque>"
}
```

**Response DTO (204):** No content

**Audit Event:** `AUTH.LOGOUT`

---

### GET /auth/me

Return current user's profile.

**RBAC:** Any authenticated user

**Response DTO (200):**
```json
{
  "id": "clx1abc2def3gh4ij",
  "email": "worker@hotel.com",
  "first_name": "Maria",
  "last_name": "Schmidt",
  "phone": "+49123456789",
  "profile_photo_url": "https://cdn.hotelcrm.com/photos/user_123.jpg",
  "role": "WORKER",
  "hotel_ids": ["clx1hotel001"],
  "permissions": [],
  "is_active": true,
  "created_at": "2026-06-09T10:00:00Z",
  "updated_at": "2026-06-09T10:00:00Z"
}
```

---

### PUT /auth/profile

Update current user's profile.

**RBAC:** Any authenticated user (own profile only)

**Request DTO:**
```json
{
  "first_name": "Maria",
  "last_name": "Schmidt",
  "phone": "+49123456789",
  "profile_photo_url": "https://cdn.hotelcrm.com/photos/user_123.jpg"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `first_name` | string | — | 1–100 chars |
| `last_name` | string | — | 1–100 chars |
| `phone` | string | — | E.164 format |
| `profile_photo_url` | string | — | Valid HTTPS URL |

**Response DTO (200):** Updated user object (same as GET /auth/me)

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid fields |

**Audit Event:** `AUTH.PROFILE_UPDATED`

---

### PUT /auth/change-password

Change authenticated user's password.

**RBAC:** Any authenticated user

**Request DTO:**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `current_password` | string | ✓ | Non-empty |
| `new_password` | string | ✓ | Min 8 chars, uppercase + digit + special |

**Response DTO (204):** No content

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 401 | `INVALID_CREDENTIALS` | Wrong current password |
| 400 | `VALIDATION_ERROR` | Password too weak |

**Audit Event:** `AUTH.PASSWORD_CHANGED`

---

## 2. Hotels

### GET /hotels

List all hotels. Managers see only their assigned hotels.

**RBAC:** ADMIN, MANAGER, CHECKER

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `city` | string | Filter by city |
| `country` | string | Filter by country (default: Germany) |
| `is_active` | boolean | Filter by active status |
| `search` | string | Search name/address (min 2 chars) |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1hotel001",
      "name": "Grand Berlin",
      "city": "Berlin",
      "country": "Germany",
      "address": "Unter den Linden 1, 10117 Berlin",
      "timezone": "Europe/Berlin",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-06-09T10:00:00Z",
      "_counts": {
        "rooms": 120,
        "active_workers": 45
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "total_pages": 1 }
}
```

---

### POST /hotels

Create a new hotel.

**RBAC:** ADMIN only

**Request DTO:**
```json
{
  "name": "Grand Berlin",
  "city": "Berlin",
  "country": "Germany",
  "address": "Unter den Linden 1, 10117 Berlin",
  "timezone": "Europe/Berlin"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | ✓ | 2–200 chars |
| `city` | string | ✓ | 2–100 chars |
| `country` | string | — | 2–100 chars, default: `Germany` |
| `address` | string | ✓ | 5–500 chars |
| `timezone` | string | — | Valid IANA timezone, default: `Europe/Berlin` |

**Response DTO (201):** Hotel object

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid fields |
| 409 | `RESOURCE_ALREADY_EXISTS` | Hotel name + city already exists |

**Audit Event:** `HOTEL.CREATED`

---

### GET /hotels/:id

Get hotel details.

**RBAC:** ADMIN; MANAGER (own hotels); CHECKER, WORKER (assigned hotels)

**Path Parameters:** `id` — hotel CUID

**Response DTO (200):**
```json
{
  "id": "clx1hotel001",
  "name": "Grand Berlin",
  "city": "Berlin",
  "country": "Germany",
  "address": "Unter den Linden 1, 10117 Berlin",
  "timezone": "Europe/Berlin",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-06-09T10:00:00Z",
  "rooms": [
    {
      "id": "clx1room001",
      "number": "101",
      "type": "single",
      "status": "clean",
      "notes": null
    }
  ],
  "_counts": {
    "rooms": 120,
    "active_workers": 45,
    "open_work_requests": 3
  }
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403 | `CANNOT_ACCESS_HOTEL` | Manager accessing unassigned hotel |
| 404 | `RESOURCE_NOT_FOUND` | Hotel not found |

---

### PUT /hotels/:id

Update hotel details.

**RBAC:** ADMIN only

**Request DTO:** Same fields as POST /hotels (all optional)

**Response DTO (200):** Updated hotel object

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | Hotel not found |
| 400 | `VALIDATION_ERROR` | Invalid fields |

**Audit Event:** `HOTEL.UPDATED`

---

### PATCH /hotels/:id/deactivate

Soft-deactivate a hotel.

**RBAC:** ADMIN only

**Request DTO:** None

**Response DTO (200):**
```json
{ "id": "clx1hotel001", "is_active": false }
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | Hotel not found |
| 422 | `INVALID_STATE_TRANSITION` | Hotel has open work requests |

**Audit Event:** `HOTEL.DEACTIVATED`

---

### GET /hotels/:id/rooms

List rooms for a hotel.

**RBAC:** ADMIN, MANAGER (own hotels), CHECKER, WORKER (assigned hotels)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | `clean` \| `dirty` \| `occupied` \| `maintenance` |
| `type` | enum | `single` \| `double` \| `suite` |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1room001",
      "hotel_id": "clx1hotel001",
      "number": "101",
      "type": "single",
      "status": "clean",
      "notes": null,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-06-09T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 120, "total_pages": 6 }
}
```

---

### POST /hotels/:id/rooms

Add a room to a hotel.

**RBAC:** ADMIN, MANAGER (own hotels)

**Request DTO:**
```json
{
  "number": "101",
  "type": "single",
  "notes": "Corner room, extra towels required"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `number` | string | ✓ | 1–20 chars, unique per hotel |
| `type` | enum | ✓ | `single` \| `double` \| `suite` |
| `notes` | string | — | Max 500 chars |

**Response DTO (201):** Room object

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 409 | `RESOURCE_ALREADY_EXISTS` | Room number already exists in hotel |

**Audit Event:** `HOTEL.ROOM_CREATED`

---

### PATCH /hotels/:id/rooms/:roomId

Update room status or details.

**RBAC:** ADMIN, MANAGER (own hotels), CHECKER (status only)

**Request DTO:**
```json
{
  "status": "dirty",
  "notes": "Stain on carpet, maintenance needed"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `status` | enum | — | `clean` \| `dirty` \| `occupied` \| `maintenance` |
| `notes` | string | — | Max 500 chars |
| `type` | enum | — | ADMIN/MANAGER only. `single` \| `double` \| `suite` |

**Response DTO (200):** Updated room object

**Audit Event:** `HOTEL.ROOM_UPDATED`

---

## 3. HotelWorker

Manages which workers are associated with a hotel.

### GET /hotels/:id/workers

List workers associated with a hotel.

**RBAC:** ADMIN, MANAGER (own hotels)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `role` | enum | `WORKER` \| `CHECKER` |
| `is_active` | boolean | Filter active/inactive |
| `search` | string | Search name or email |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1user001",
      "email": "maria@hotel.com",
      "first_name": "Maria",
      "last_name": "Schmidt",
      "phone": "+49123456789",
      "profile_photo_url": null,
      "role": "WORKER",
      "is_active": true,
      "overall_rating": {
        "average_score": 4.7,
        "total_ratings": 38
      },
      "created_at": "2026-01-15T08:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "total_pages": 3 }
}
```

---

### POST /hotels/:id/workers

Add an existing user to a hotel's workforce.

**RBAC:** ADMIN, MANAGER (own hotels)

**Request DTO:**
```json
{
  "user_id": "clx1user001"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `user_id` | string | ✓ | Valid CUID, user must exist with role WORKER or CHECKER |

**Response DTO (201):**
```json
{
  "user_id": "clx1user001",
  "hotel_id": "clx1hotel001",
  "added_at": "2026-06-09T10:00:00Z"
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | User not found |
| 409 | `RESOURCE_ALREADY_EXISTS` | User already in hotel |
| 422 | `OPERATION_NOT_ALLOWED` | Cannot add ADMIN/MANAGER this way |

**Audit Event:** `HOTEL_WORKER.ADDED`

---

### DELETE /hotels/:id/workers/:userId

Remove a worker from a hotel.

**RBAC:** ADMIN, MANAGER (own hotels)

**Response DTO (204):** No content

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | User not in hotel |
| 422 | `OPERATION_NOT_ALLOWED` | Worker has active assignments |

**Audit Event:** `HOTEL_WORKER.REMOVED`

---

### GET /workers/:userId

Get a worker's full profile including cross-hotel stats.

**RBAC:** ADMIN; MANAGER (worker must be in own hotel); WORKER (own profile only)

**Response DTO (200):**
```json
{
  "id": "clx1user001",
  "email": "maria@hotel.com",
  "first_name": "Maria",
  "last_name": "Schmidt",
  "phone": "+49123456789",
  "profile_photo_url": null,
  "role": "WORKER",
  "hotel_ids": ["clx1hotel001"],
  "is_active": true,
  "overall_rating": {
    "average_score": 4.7,
    "total_ratings": 38
  },
  "created_at": "2026-01-15T08:00:00Z",
  "updated_at": "2026-06-09T10:00:00Z"
}
```

---

### PATCH /workers/:userId/activate

Activate or deactivate a worker account.

**RBAC:** ADMIN only

**Request DTO:**
```json
{ "is_active": false }
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `is_active` | boolean | ✓ | |

**Response DTO (200):** Updated user object

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | User not found |
| 422 | `OPERATION_NOT_ALLOWED` | Cannot deactivate own account |

**Audit Event:** `WORKER.ACTIVATED` / `WORKER.DEACTIVATED`

---

## 4. WorkRequest

Managers post shifts they need filled.

### GET /work-requests

List work requests.

**RBAC:** ADMIN; MANAGER (own hotels); WORKER, CHECKER (status=OPEN, their hotel)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hotel_id` | string | Filter by hotel |
| `status` | enum | `OPEN` \| `PARTIALLY_FILLED` \| `FILLED` \| `CANCELLED` |
| `position` | string | Filter by position |
| `shift_date` | date | ISO date (YYYY-MM-DD) |
| `shift_date_from` | date | Range start |
| `shift_date_to` | date | Range end |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1wr001",
      "hotel_id": "clx1hotel001",
      "hotel": { "id": "clx1hotel001", "name": "Grand Berlin" },
      "position": "cleaner",
      "workers_needed": 3,
      "workers_filled": 2,
      "shift_date": "2026-06-15",
      "shift_start_time": "08:00",
      "shift_end_time": "16:00",
      "notes": "Deep clean floors 3-5",
      "status": "PARTIALLY_FILLED",
      "created_by": { "id": "clx1mgr001", "first_name": "Hans", "last_name": "Müller" },
      "created_at": "2026-06-09T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "total_pages": 1 }
}
```

---

### POST /work-requests

Create a new work request.

**RBAC:** ADMIN, MANAGER (own hotels)

**Request DTO:**
```json
{
  "hotel_id": "clx1hotel001",
  "position": "cleaner",
  "workers_needed": 3,
  "shift_date": "2026-06-15",
  "shift_start_time": "08:00",
  "shift_end_time": "16:00",
  "notes": "Deep clean floors 3-5"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `hotel_id` | string | ✓ | Valid CUID, accessible hotel |
| `position` | string | ✓ | `cleaner` \| `checker` \| `housekeeper` \| `maintenance`, max 100 chars |
| `workers_needed` | integer | ✓ | 1–50 |
| `shift_date` | string | ✓ | ISO date (YYYY-MM-DD), not in the past |
| `shift_start_time` | string | ✓ | HH:MM (24h) |
| `shift_end_time` | string | ✓ | HH:MM, must be after shift_start_time |
| `notes` | string | — | Max 1000 chars |

**Response DTO (201):** WorkRequest object (see GET response item)

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid fields |
| 403 | `CANNOT_ACCESS_HOTEL` | Manager accessing unassigned hotel |

**Audit Event:** `WORK_REQUEST.CREATED`

---

### GET /work-requests/:id

Get work request details.

**RBAC:** ADMIN; MANAGER (own hotels); WORKER (status=OPEN)

**Response DTO (200):**
```json
{
  "id": "clx1wr001",
  "hotel_id": "clx1hotel001",
  "hotel": { "id": "clx1hotel001", "name": "Grand Berlin", "city": "Berlin" },
  "position": "cleaner",
  "workers_needed": 3,
  "workers_filled": 2,
  "shift_date": "2026-06-15",
  "shift_start_time": "08:00",
  "shift_end_time": "16:00",
  "notes": "Deep clean floors 3-5",
  "status": "PARTIALLY_FILLED",
  "created_by": { "id": "clx1mgr001", "first_name": "Hans", "last_name": "Müller" },
  "assignments": [
    {
      "id": "clx1wa001",
      "worker": { "id": "clx1user001", "first_name": "Maria", "last_name": "Schmidt" },
      "status": "ASSIGNED",
      "assigned_at": "2026-06-09T11:00:00Z"
    }
  ],
  "created_at": "2026-06-09T10:00:00Z",
  "filled_at": null,
  "cancelled_at": null
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | Work request not found |
| 403 | `CANNOT_ACCESS_HOTEL` | Outside manager's hotel scope |

---

### PATCH /work-requests/:id

Update a work request (only while OPEN or PARTIALLY_FILLED).

**RBAC:** ADMIN, MANAGER (own hotels, own request)

**Request DTO:**
```json
{
  "workers_needed": 4,
  "notes": "Updated notes",
  "shift_start_time": "09:00",
  "shift_end_time": "17:00"
}
```

All fields optional. Same validation rules as POST.

**Response DTO (200):** Updated WorkRequest object

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `INVALID_STATE_TRANSITION` | Request is FILLED or CANCELLED |
| 400 | `VALIDATION_ERROR` | Invalid fields |

**Audit Event:** `WORK_REQUEST.UPDATED`

---

### PATCH /work-requests/:id/cancel

Cancel a work request.

**RBAC:** ADMIN, MANAGER (own hotels, own request)

**Request DTO:**
```json
{ "reason": "Shift no longer needed" }
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `reason` | string | — | Max 500 chars |

**Response DTO (200):**
```json
{ "id": "clx1wr001", "status": "CANCELLED", "cancelled_at": "2026-06-09T12:00:00Z" }
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `INVALID_STATE_TRANSITION` | Already FILLED or CANCELLED |

**Audit Event:** `WORK_REQUEST.CANCELLED`

---

## 5. WorkApplication

Workers express interest in open work requests.

### GET /work-requests/:id/applications

List applications for a work request.

**RBAC:** ADMIN, MANAGER (own hotels)

**Query Parameters:** `page`, `limit`, `status`

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1app001",
      "work_request_id": "clx1wr001",
      "worker": {
        "id": "clx1user001",
        "first_name": "Maria",
        "last_name": "Schmidt",
        "overall_rating": { "average_score": 4.7, "total_ratings": 38 }
      },
      "status": "PENDING",
      "note": "Available and experienced with deep cleans",
      "applied_at": "2026-06-09T10:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "total_pages": 1 }
}
```

---

### POST /work-requests/:id/apply

Worker applies for a work request.

**RBAC:** WORKER (must be associated with the hotel)

**Request DTO:**
```json
{
  "note": "Available and experienced with deep cleans"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `note` | string | — | Max 500 chars |

**Response DTO (201):**
```json
{
  "id": "clx1app001",
  "work_request_id": "clx1wr001",
  "worker_id": "clx1user001",
  "status": "PENDING",
  "applied_at": "2026-06-09T10:30:00Z"
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403 | `CANNOT_ACCESS_HOTEL` | Worker not associated with hotel |
| 409 | `RESOURCE_ALREADY_EXISTS` | Already applied |
| 422 | `INVALID_STATE_TRANSITION` | Work request not OPEN or PARTIALLY_FILLED |
| 422 | `WORKER_ALREADY_ASSIGNED` | Worker has conflicting active assignment same shift date |

**Audit Event:** `WORK_APPLICATION.SUBMITTED`

---

### PATCH /work-requests/:id/applications/:applicationId

Accept or reject a worker's application.

**RBAC:** ADMIN, MANAGER (own hotels)

**Request DTO:**
```json
{
  "status": "ACCEPTED",
  "note": "Welcome to the team for this shift"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `status` | enum | ✓ | `ACCEPTED` \| `REJECTED` |
| `note` | string | — | Max 500 chars |

**Response DTO (200):**
```json
{
  "id": "clx1app001",
  "status": "ACCEPTED",
  "reviewed_at": "2026-06-09T11:00:00Z"
}
```

Note: Accepting an application automatically creates a WorkerAssignment record.

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `INVALID_STATE_TRANSITION` | Application already reviewed |
| 422 | `OPERATION_NOT_ALLOWED` | Work request already FILLED |

**Audit Event:** `WORK_APPLICATION.ACCEPTED` / `WORK_APPLICATION.REJECTED`

---

### DELETE /work-requests/:id/applications/:applicationId

Worker withdraws their own application.

**RBAC:** WORKER (own application only); MANAGER can also withdraw on behalf

**Response DTO (204):** No content

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 403 | `FORBIDDEN` | Not the applicant or manager |
| 422 | `INVALID_STATE_TRANSITION` | Application already ACCEPTED |

**Audit Event:** `WORK_APPLICATION.WITHDRAWN`

---

## 6. WorkerAssignment

Tracks confirmed worker-to-shift assignments.

### GET /assignments

List assignments.

**RBAC:** ADMIN; MANAGER (own hotels); WORKER (own assignments)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hotel_id` | string | Filter by hotel |
| `worker_id` | string | Filter by worker (ADMIN/MANAGER only) |
| `work_request_id` | string | Filter by work request |
| `status` | enum | `ASSIGNED` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED` \| `REASSIGNED` |
| `shift_date` | date | ISO date |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1wa001",
      "worker": {
        "id": "clx1user001",
        "first_name": "Maria",
        "last_name": "Schmidt"
      },
      "work_request": {
        "id": "clx1wr001",
        "hotel": { "id": "clx1hotel001", "name": "Grand Berlin" },
        "position": "cleaner",
        "shift_date": "2026-06-15",
        "shift_start_time": "08:00",
        "shift_end_time": "16:00"
      },
      "status": "ASSIGNED",
      "assigned_at": "2026-06-09T11:00:00Z",
      "started_at": null,
      "completed_at": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "total_pages": 1 }
}
```

---

### POST /work-requests/:id/assign

Directly assign workers to a work request (bypass application flow).

**RBAC:** ADMIN, MANAGER (own hotels)

**Request DTO:**
```json
{
  "worker_ids": ["clx1user001", "clx1user002"]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `worker_ids` | string[] | ✓ | 1–50 items, all valid CUIDs |

**Response DTO (201):**
```json
{
  "assignments": [
    {
      "id": "clx1wa001",
      "worker_id": "clx1user001",
      "work_request_id": "clx1wr001",
      "status": "ASSIGNED",
      "assigned_at": "2026-06-09T11:00:00Z"
    }
  ],
  "work_request": {
    "id": "clx1wr001",
    "status": "PARTIALLY_FILLED",
    "workers_filled": 1,
    "workers_needed": 3
  }
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `WORKER_ALREADY_ASSIGNED` | One or more workers already assigned |
| 422 | `INVALID_STATE_TRANSITION` | Work request is FILLED or CANCELLED |
| 404 | `RESOURCE_NOT_FOUND` | Worker not found or not in hotel |

**Audit Event:** `WORKER_ASSIGNMENT.CREATED`

---

### GET /assignments/:id

Get assignment details.

**RBAC:** ADMIN; MANAGER (own hotels); WORKER (own assignments)

**Response DTO (200):**
```json
{
  "id": "clx1wa001",
  "worker": { "id": "clx1user001", "first_name": "Maria", "last_name": "Schmidt" },
  "work_request": {
    "id": "clx1wr001",
    "hotel": { "id": "clx1hotel001", "name": "Grand Berlin" },
    "position": "cleaner",
    "shift_date": "2026-06-15",
    "shift_start_time": "08:00",
    "shift_end_time": "16:00"
  },
  "assigned_by": { "id": "clx1mgr001", "first_name": "Hans", "last_name": "Müller" },
  "status": "ASSIGNED",
  "assigned_at": "2026-06-09T11:00:00Z",
  "started_at": null,
  "completed_at": null,
  "daily_operations": [],
  "previous_assignment_id": null
}
```

---

### PATCH /assignments/:id/cancel

Cancel a specific assignment.

**RBAC:** ADMIN, MANAGER (own hotels)

**Request DTO:**
```json
{ "reason": "Worker unavailable" }
```

**Response DTO (200):**
```json
{ "id": "clx1wa001", "status": "CANCELLED" }
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `INVALID_STATE_TRANSITION` | Assignment already COMPLETED or CANCELLED |

**Audit Event:** `WORKER_ASSIGNMENT.CANCELLED`

---

### POST /assignments/:id/reassign

Reassign work to a different worker.

**RBAC:** ADMIN, MANAGER (own hotels)

**Request DTO:**
```json
{
  "new_worker_id": "clx1user003",
  "reason": "Original worker called in sick"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `new_worker_id` | string | ✓ | Valid CUID, worker in same hotel |
| `reason` | string | — | Max 500 chars |

**Response DTO (201):**
```json
{
  "old_assignment": { "id": "clx1wa001", "status": "REASSIGNED" },
  "new_assignment": { "id": "clx1wa002", "worker_id": "clx1user003", "status": "ASSIGNED" }
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `WORKER_ALREADY_ASSIGNED` | New worker already has active assignment |
| 422 | `INVALID_STATE_TRANSITION` | Original assignment already COMPLETED/CANCELLED |

**Audit Event:** `WORKER_ASSIGNMENT.REASSIGNED`

---

## 7. Attendance

Tracks actual clock-in/clock-out for assigned shifts.

### POST /assignments/:id/clock-in

Worker starts their shift.

**RBAC:** WORKER (own assignment); MANAGER can proxy clock-in

**Request DTO:**
```json
{
  "location": { "latitude": 52.5200, "longitude": 13.4050 },
  "note": "Arrived on time"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `location` | object | — | Valid lat/lng coordinates |
| `location.latitude` | number | — | -90 to 90 |
| `location.longitude` | number | — | -180 to 180 |
| `note` | string | — | Max 500 chars |

**Response DTO (200):**
```json
{
  "id": "clx1wa001",
  "status": "IN_PROGRESS",
  "started_at": "2026-06-15T08:03:00Z"
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `INVALID_STATE_TRANSITION` | Assignment not in ASSIGNED status |
| 403 | `FORBIDDEN` | Not own assignment |

**Audit Event:** `ATTENDANCE.CLOCK_IN`

---

### POST /assignments/:id/clock-out

Worker completes their shift.

**RBAC:** WORKER (own assignment); MANAGER can proxy clock-out

**Request DTO:**
```json
{
  "location": { "latitude": 52.5200, "longitude": 13.4050 },
  "note": "All tasks completed"
}
```

**Response DTO (200):**
```json
{
  "id": "clx1wa001",
  "status": "COMPLETED",
  "started_at": "2026-06-15T08:03:00Z",
  "completed_at": "2026-06-15T16:01:00Z",
  "duration_minutes": 478
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `INVALID_STATE_TRANSITION` | Assignment not IN_PROGRESS |
| 403 | `FORBIDDEN` | Not own assignment |

**Audit Event:** `ATTENDANCE.CLOCK_OUT`

---

### GET /hotels/:id/attendance

View attendance summary for a hotel on a given date.

**RBAC:** ADMIN, MANAGER (own hotels)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | date | ISO date (YYYY-MM-DD), required |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "date": "2026-06-15",
  "hotel_id": "clx1hotel001",
  "summary": {
    "total_assigned": 10,
    "clocked_in": 8,
    "completed": 6,
    "absent": 2
  },
  "data": [
    {
      "assignment_id": "clx1wa001",
      "worker": { "id": "clx1user001", "first_name": "Maria", "last_name": "Schmidt" },
      "position": "cleaner",
      "shift_start_time": "08:00",
      "shift_end_time": "16:00",
      "status": "COMPLETED",
      "started_at": "2026-06-15T08:03:00Z",
      "completed_at": "2026-06-15T16:01:00Z",
      "duration_minutes": 478
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 10, "total_pages": 1 }
}
```

---

### GET /workers/:userId/attendance

Get attendance history for a worker.

**RBAC:** ADMIN; MANAGER (worker must be in own hotel); WORKER (own history only)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | date | ISO date range start |
| `to` | date | ISO date range end |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "worker_id": "clx1user001",
  "data": [
    {
      "assignment_id": "clx1wa001",
      "hotel": { "id": "clx1hotel001", "name": "Grand Berlin" },
      "position": "cleaner",
      "shift_date": "2026-06-15",
      "started_at": "2026-06-15T08:03:00Z",
      "completed_at": "2026-06-15T16:01:00Z",
      "duration_minutes": 478,
      "status": "COMPLETED"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "total_pages": 3 }
}
```

---

## 8. QualityVerification

Checkers verify completed tasks against quality standards.

### GET /quality/verifications

List quality verifications.

**RBAC:** ADMIN; MANAGER (own hotels); CHECKER (own verifications)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hotel_id` | string | Filter by hotel |
| `task_id` | string | Filter by task |
| `checker_id` | string | Filter by checker |
| `status` | enum | `verified` \| `needs_rework` |
| `score_min` | integer | Min score (0-100) |
| `score_max` | integer | Max score (0-100) |
| `from` | datetime | Created after |
| `to` | datetime | Created before |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1qv001",
      "task_id": "clx1task001",
      "task": {
        "id": "clx1task001",
        "description": "Clean room 101",
        "room": { "number": "101", "type": "single" }
      },
      "hotel_id": "clx1hotel001",
      "verified_by": { "id": "clx1chkr001", "first_name": "Anna", "last_name": "Weber" },
      "score": 92,
      "notes": "Excellent work, minor dust on window sill",
      "status": "verified",
      "created_at": "2026-06-15T17:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 30, "total_pages": 2 }
}
```

---

### POST /quality/verifications

Submit a quality verification for a completed task.

**RBAC:** CHECKER (must be associated with the hotel)

**Request DTO:**
```json
{
  "task_id": "clx1task001",
  "score": 92,
  "notes": "Excellent work, minor dust on window sill",
  "status": "verified"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `task_id` | string | ✓ | Valid CUID, task must be COMPLETED |
| `score` | integer | ✓ | 0–100 |
| `notes` | string | — | Max 2000 chars |
| `status` | enum | ✓ | `verified` \| `needs_rework` |

**Response DTO (201):** QualityVerification object (see GET item)

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | Task not found |
| 409 | `RESOURCE_ALREADY_EXISTS` | Verification already exists for task |
| 422 | `INVALID_STATE_TRANSITION` | Task not in COMPLETED status |
| 403 | `CANNOT_ACCESS_HOTEL` | Checker not in hotel |

**Audit Event:** `QUALITY.VERIFICATION_SUBMITTED`

---

### GET /quality/verifications/:id

Get a single quality verification.

**RBAC:** ADMIN; MANAGER (own hotels); CHECKER (own verifications)

**Response DTO (200):** Full QualityVerification object

---

### PATCH /quality/verifications/:id

Update a quality verification (within 24h of creation).

**RBAC:** CHECKER (own verification, within 24h); ADMIN

**Request DTO:**
```json
{
  "score": 88,
  "notes": "Re-checked — linen was not properly tucked",
  "status": "needs_rework"
}
```

All fields optional.

**Response DTO (200):** Updated QualityVerification object

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 422 | `OPERATION_NOT_ALLOWED` | Edit window (24h) expired |
| 403 | `FORBIDDEN` | Not the verifying checker |

**Audit Event:** `QUALITY.VERIFICATION_UPDATED`

---

## 9. Rating

Checkers rate workers after quality verification.

### GET /ratings

List ratings.

**RBAC:** ADMIN; MANAGER (own hotels); CHECKER (own ratings); WORKER (own received ratings)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hotel_id` | string | Filter by hotel |
| `worker_id` | string | Filter by worker |
| `checker_id` | string | Filter by checker |
| `score_min` | integer | Min score (0-5) |
| `score_max` | integer | Max score (0-5) |
| `from` | datetime | Created after |
| `to` | datetime | Created before |
| `page` | integer | |
| `limit` | integer | |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1rat001",
      "task_id": "clx1task001",
      "hotel_id": "clx1hotel001",
      "worker": { "id": "clx1user001", "first_name": "Maria", "last_name": "Schmidt" },
      "rated_by": { "id": "clx1chkr001", "first_name": "Anna", "last_name": "Weber" },
      "score": 5,
      "comment": "Outstanding work, very thorough",
      "created_at": "2026-06-15T17:05:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "total_pages": 3 }
}
```

---

### POST /ratings

Submit a rating for a worker after task completion.

**RBAC:** CHECKER (must be associated with hotel and have submitted quality verification for the same task)

**Request DTO:**
```json
{
  "task_id": "clx1task001",
  "worker_id": "clx1user001",
  "score": 5,
  "comment": "Outstanding work, very thorough"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `task_id` | string | ✓ | Valid CUID, task must be COMPLETED |
| `worker_id` | string | ✓ | Valid CUID, must be the assigned worker |
| `score` | integer | ✓ | 1–5 (integer stars) |
| `comment` | string | — | Max 1000 chars |

**Response DTO (201):**
```json
{
  "id": "clx1rat001",
  "task_id": "clx1task001",
  "worker_id": "clx1user001",
  "rated_by_checker_id": "clx1chkr001",
  "score": 5,
  "comment": "Outstanding work, very thorough",
  "created_at": "2026-06-15T17:05:00Z",
  "worker_overall_rating": {
    "average_score": 4.72,
    "total_ratings": 39
  }
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 409 | `RESOURCE_ALREADY_EXISTS` | Rating already submitted for this task |
| 422 | `INVALID_STATE_TRANSITION` | Task not COMPLETED |
| 422 | `OPERATION_NOT_ALLOWED` | No quality verification exists for this task by this checker |
| 403 | `CANNOT_ACCESS_HOTEL` | Checker not in hotel |

**Audit Event:** `RATING.SUBMITTED`

---

### GET /ratings/leaderboard

Worker leaderboard by average rating.

**RBAC:** ADMIN, MANAGER (own hotels), CHECKER

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hotel_id` | string | Scope to specific hotel |
| `period` | enum | `week` \| `month` \| `quarter` \| `all_time` (default: `month`) |
| `limit` | integer | Top N workers (max 100, default 20) |

**Response DTO (200):**
```json
{
  "period": "month",
  "hotel_id": "clx1hotel001",
  "data": [
    {
      "rank": 1,
      "worker": {
        "id": "clx1user001",
        "first_name": "Maria",
        "last_name": "Schmidt",
        "profile_photo_url": null
      },
      "average_score": 4.92,
      "total_ratings": 12,
      "total_tasks_completed": 14
    }
  ]
}
```

---

### GET /workers/:userId/ratings

Get all ratings for a specific worker.

**RBAC:** ADMIN; MANAGER (worker in own hotel); CHECKER; WORKER (own ratings)

**Query Parameters:** `from`, `to`, `hotel_id`, `page`, `limit`

**Response DTO (200):**
```json
{
  "worker_id": "clx1user001",
  "summary": {
    "average_score": 4.72,
    "total_ratings": 39,
    "score_distribution": { "1": 0, "2": 1, "3": 2, "4": 8, "5": 28 }
  },
  "data": [ /* Rating objects */ ],
  "pagination": { "page": 1, "limit": 20, "total": 39, "total_pages": 2 }
}
```

---

## 10. Notifications

### GET /notifications

List notifications for the authenticated user.

**RBAC:** Any authenticated user (own notifications only)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `is_read` | boolean | Filter by read status |
| `type` | string | Notification type filter |
| `page` | integer | |
| `limit` | integer | |

**Notification Types:**

| Type | Description |
|------|-------------|
| `TASK_ASSIGNED` | New task assigned to worker |
| `TASK_COMPLETED` | Worker completed a task |
| `QUALITY_VERIFIED` | Quality verification submitted |
| `RATING_RECEIVED` | Worker received a new rating |
| `WORK_REQUEST_OPEN` | New open work request in hotel |
| `ASSIGNMENT_CREATED` | Worker assigned to a shift |
| `ASSIGNMENT_CANCELLED` | Assignment was cancelled |
| `ASSIGNMENT_REASSIGNED` | Assignment was reassigned |
| `WORK_REQUEST_FILLED` | All positions filled |
| `DOCUMENT_EXPIRING` | Worker document expiring in 30/14/7 days |
| `PAYROLL_APPROVED` | Payroll approved |
| `PAYROLL_PAID` | Payroll marked as paid |

**Response DTO (200):**
```json
{
  "data": [
    {
      "id": "clx1notif001",
      "type": "TASK_ASSIGNED",
      "title": "New task assigned",
      "message": "You have been assigned to clean room 101 at Grand Berlin",
      "data": {
        "task_id": "clx1task001",
        "hotel_id": "clx1hotel001",
        "room_number": "101"
      },
      "is_read": false,
      "read_at": null,
      "created_at": "2026-06-15T08:00:00Z"
    }
  ],
  "unread_count": 3,
  "pagination": { "page": 1, "limit": 20, "total": 15, "total_pages": 1 }
}
```

---

### GET /notifications/unread-count

Get unread notification count only (lightweight for polling).

**RBAC:** Any authenticated user

**Response DTO (200):**
```json
{ "unread_count": 3 }
```

---

### PATCH /notifications/:id/read

Mark a single notification as read.

**RBAC:** Any authenticated user (own notifications only)

**Response DTO (200):**
```json
{
  "id": "clx1notif001",
  "is_read": true,
  "read_at": "2026-06-09T11:00:00Z"
}
```

**Error Codes:**

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `RESOURCE_NOT_FOUND` | Notification not found |
| 403 | `FORBIDDEN` | Not own notification |

---

### POST /notifications/read-all

Mark all unread notifications as read.

**RBAC:** Any authenticated user

**Response DTO (200):**
```json
{ "marked_read": 3 }
```

---

### DELETE /notifications/:id

Delete a notification.

**RBAC:** Any authenticated user (own notifications only)

**Response DTO (204):** No content

---

## Shared Schemas

### UserSummary
```json
{
  "id": "clx1user001",
  "first_name": "Maria",
  "last_name": "Schmidt",
  "role": "WORKER"
}
```

### HotelSummary
```json
{
  "id": "clx1hotel001",
  "name": "Grand Berlin",
  "city": "Berlin"
}
```

### WorkRequestSummary
```json
{
  "id": "clx1wr001",
  "position": "cleaner",
  "shift_date": "2026-06-15",
  "shift_start_time": "08:00",
  "shift_end_time": "16:00",
  "status": "OPEN"
}
```

### PaginationMeta
```json
{
  "page": 1,
  "limit": 20,
  "total": 142,
  "total_pages": 8
}
```

---

## Error Reference

### Complete Error Code Table

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | JWT or refresh token expired |
| `TOKEN_INVALID` | 401 | Malformed or unknown token |
| `ACCOUNT_DISABLED` | 403 | User account deactivated |
| `UNAUTHORIZED` | 401 | No auth token provided |
| `FORBIDDEN` | 403 | Authenticated but lacks permission |
| `INSUFFICIENT_PERMISSION` | 403 | Missing required fine-grained permission |
| `CANNOT_ACCESS_HOTEL` | 403 | Hotel not in manager's assigned hotel_ids |
| `CANNOT_ACCESS_RESOURCE` | 403 | Resource belongs to different user/hotel |
| `VALIDATION_ERROR` | 400 | One or more fields failed validation |
| `MISSING_REQUIRED_FIELD` | 400 | Required field absent |
| `INVALID_ENUM_VALUE` | 400 | Value not in allowed enum |
| `INVALID_FORMAT` | 400 | Field format invalid (email, date, etc.) |
| `INVALID_REQUEST` | 400 | Malformed request body |
| `RESOURCE_NOT_FOUND` | 404 | Entity with given ID does not exist |
| `RESOURCE_ALREADY_EXISTS` | 409 | Unique constraint violation |
| `CONCURRENCY_VIOLATION` | 409 | Optimistic lock conflict |
| `OPERATION_NOT_ALLOWED` | 409 | Business rule prevents operation |
| `WORKER_ALREADY_ASSIGNED` | 422 | Worker has conflicting active assignment |
| `TASK_ALREADY_COMPLETED` | 422 | Task already in terminal state |
| `INVALID_STATE_TRANSITION` | 422 | Current status disallows this transition |
| `GDPR_CONSTRAINT_VIOLATION` | 422 | Data retention policy prevents operation |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `DATABASE_ERROR` | 500 | Unexpected database failure |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Downstream dependency unavailable |

### Validation Error Detail Format
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "shift_date",
      "message": "shift_date must be a future date",
      "value": "2020-01-01"
    },
    {
      "field": "workers_needed",
      "message": "workers_needed must be between 1 and 50",
      "value": 0
    }
  ]
}
```

---

## Audit Event Reference

All audit events are written to the `AuditLog` table and include:
- `actor_id` — authenticated user performing the action
- `actor_role` — role at time of action
- `action` — event code below
- `resource_type` — entity type
- `resource_id` — entity CUID
- `details` — JSON snapshot of relevant data
- `ip_address` — request IP
- `timestamp` — UTC datetime

### Event Catalog

| Event Code | Module | Trigger |
|------------|--------|---------|
| `AUTH.USER_REGISTERED` | Auth | New user signup |
| `AUTH.LOGIN_SUCCESS` | Auth | Successful login |
| `AUTH.LOGIN_FAILURE` | Auth | Failed login attempt |
| `AUTH.LOGOUT` | Auth | Session revoked |
| `AUTH.TOKEN_REFRESHED` | Auth | Refresh token exchanged |
| `AUTH.PASSWORD_CHANGED` | Auth | Password updated |
| `AUTH.PROFILE_UPDATED` | Auth | Profile fields updated |
| `HOTEL.CREATED` | Hotels | New hotel created |
| `HOTEL.UPDATED` | Hotels | Hotel details changed |
| `HOTEL.DEACTIVATED` | Hotels | Hotel soft-deactivated |
| `HOTEL.ROOM_CREATED` | Hotels | Room added to hotel |
| `HOTEL.ROOM_UPDATED` | Hotels | Room status/details changed |
| `HOTEL_WORKER.ADDED` | HotelWorker | User added to hotel workforce |
| `HOTEL_WORKER.REMOVED` | HotelWorker | User removed from hotel workforce |
| `WORKER.ACTIVATED` | HotelWorker | Worker account activated |
| `WORKER.DEACTIVATED` | HotelWorker | Worker account deactivated |
| `WORK_REQUEST.CREATED` | WorkRequest | New shift posted |
| `WORK_REQUEST.UPDATED` | WorkRequest | Shift details changed |
| `WORK_REQUEST.CANCELLED` | WorkRequest | Shift cancelled |
| `WORK_APPLICATION.SUBMITTED` | WorkApplication | Worker applied for shift |
| `WORK_APPLICATION.ACCEPTED` | WorkApplication | Application accepted → assignment created |
| `WORK_APPLICATION.REJECTED` | WorkApplication | Application rejected |
| `WORK_APPLICATION.WITHDRAWN` | WorkApplication | Application withdrawn |
| `WORKER_ASSIGNMENT.CREATED` | WorkerAssignment | Direct assignment created |
| `WORKER_ASSIGNMENT.CANCELLED` | WorkerAssignment | Assignment cancelled |
| `WORKER_ASSIGNMENT.REASSIGNED` | WorkerAssignment | Assignment transferred to new worker |
| `ATTENDANCE.CLOCK_IN` | Attendance | Worker started shift |
| `ATTENDANCE.CLOCK_OUT` | Attendance | Worker completed shift |
| `QUALITY.VERIFICATION_SUBMITTED` | QualityVerification | Checker submitted verification |
| `QUALITY.VERIFICATION_UPDATED` | QualityVerification | Checker amended verification |
| `RATING.SUBMITTED` | Rating | Checker rated worker |
| `NOTIFICATION.READ` | Notifications | Notification marked read |

---

## RBAC Matrix

### Endpoint Permission Matrix

| Endpoint | WORKER | CHECKER | MANAGER | ADMIN |
|----------|--------|---------|---------|-------|
| POST /auth/signup | ✓ | ✓ | ✓* | ✓ |
| POST /auth/login | ✓ | ✓ | ✓ | ✓ |
| GET /auth/me | ✓ | ✓ | ✓ | ✓ |
| PUT /auth/profile | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| GET /hotels | — | ✓ | ✓ (own) | ✓ |
| POST /hotels | — | — | — | ✓ |
| GET /hotels/:id | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| PUT /hotels/:id | — | — | — | ✓ |
| PATCH /hotels/:id/deactivate | — | — | — | ✓ |
| GET /hotels/:id/rooms | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| POST /hotels/:id/rooms | — | — | ✓ (own) | ✓ |
| PATCH /hotels/:id/rooms/:roomId | — | ✓ (status) | ✓ (own) | ✓ |
| GET /hotels/:id/workers | — | — | ✓ (own) | ✓ |
| POST /hotels/:id/workers | — | — | ✓ (own) | ✓ |
| DELETE /hotels/:id/workers/:userId | — | — | ✓ (own) | ✓ |
| GET /workers/:userId | ✓ (own) | — | ✓ (own hotel) | ✓ |
| PATCH /workers/:userId/activate | — | — | — | ✓ |
| GET /work-requests | ✓ (OPEN) | ✓ (OPEN) | ✓ (own) | ✓ |
| POST /work-requests | — | — | ✓ (own) | ✓ |
| GET /work-requests/:id | ✓ (OPEN) | ✓ | ✓ (own) | ✓ |
| PATCH /work-requests/:id | — | — | ✓ (own, own request) | ✓ |
| PATCH /work-requests/:id/cancel | — | — | ✓ (own) | ✓ |
| GET /work-requests/:id/applications | — | — | ✓ (own) | ✓ |
| POST /work-requests/:id/apply | ✓ (own hotel) | — | — | — |
| PATCH /work-requests/:id/applications/:id | — | — | ✓ (own) | ✓ |
| DELETE /work-requests/:id/applications/:id | ✓ (own) | — | ✓ (own) | ✓ |
| GET /assignments | ✓ (own) | — | ✓ (own) | ✓ |
| POST /work-requests/:id/assign | — | — | ✓ (own) | ✓ |
| GET /assignments/:id | ✓ (own) | — | ✓ (own) | ✓ |
| PATCH /assignments/:id/cancel | — | — | ✓ (own) | ✓ |
| POST /assignments/:id/reassign | — | — | ✓ (own) | ✓ |
| POST /assignments/:id/clock-in | ✓ (own) | — | ✓ (proxy) | ✓ |
| POST /assignments/:id/clock-out | ✓ (own) | — | ✓ (proxy) | ✓ |
| GET /hotels/:id/attendance | — | — | ✓ (own) | ✓ |
| GET /workers/:userId/attendance | ✓ (own) | — | ✓ (own hotel) | ✓ |
| GET /quality/verifications | — | ✓ (own) | ✓ (own) | ✓ |
| POST /quality/verifications | — | ✓ (own hotel) | — | ✓ |
| GET /quality/verifications/:id | — | ✓ (own) | ✓ (own) | ✓ |
| PATCH /quality/verifications/:id | — | ✓ (own, 24h) | — | ✓ |
| GET /ratings | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| POST /ratings | — | ✓ (own hotel) | — | ✓ |
| GET /ratings/leaderboard | — | ✓ | ✓ (own) | ✓ |
| GET /workers/:userId/ratings | ✓ (own) | ✓ | ✓ (own hotel) | ✓ |
| GET /notifications | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| GET /notifications/unread-count | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| PATCH /notifications/:id/read | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| POST /notifications/read-all | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |
| DELETE /notifications/:id | ✓ (own) | ✓ (own) | ✓ (own) | ✓ |

*Creating MANAGER/ADMIN role accounts via signup requires an existing ADMIN token.

**Legend:**
- `✓` — Allowed
- `—` — Denied (403 FORBIDDEN)
- `(own)` — Scoped to own resources (hotel_ids, user_id, etc.)
- `(own hotel)` — Scoped to hotels in manager's hotel_ids
- `(status)` — Limited to specific fields

---

## Rate Limiting

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| POST /auth/login | 10 requests | 15 minutes per IP |
| POST /auth/signup | 5 requests | 60 minutes per IP |
| POST /auth/refresh | 30 requests | 60 minutes per user |
| All other endpoints | 300 requests | 60 minutes per user |

Rate limit response headers:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 247
X-RateLimit-Reset: 1718000000
```

---

*Specification version: 1.0.0 — Generated 2026-06-09*
