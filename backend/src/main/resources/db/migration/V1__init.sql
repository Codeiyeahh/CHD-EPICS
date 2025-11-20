create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists doctor (
  doctor_id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext not null unique,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists doctor_auth (
  doctor_id uuid primary key references doctor(doctor_id) on delete cascade,
  password_hash text not null,
  mfa_enabled boolean not null default false,
  mfa_secret text,
  last_password_reset timestamptz
);

create table if not exists doctor_crypto (
  doctor_id uuid primary key references doctor(doctor_id) on delete cascade,
  public_key bytea not null,
  private_key_enc bytea not null,
  private_key_salt bytea not null,
  kek_params jsonb not null
);

create table if not exists session (
  session_id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctor(doctor_id) on delete cascade,
  login_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  logout_at timestamptz,
  ended_by text check (ended_by in ('logout','timeout')),
  ip inet,
  user_agent text
);
create index if not exists idx_session_doctor_time on session(doctor_id, login_at);

create table if not exists audit_log (
  audit_id bigserial primary key,
  session_id uuid references session(session_id),
  doctor_id uuid references doctor(doctor_id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_doctor_time on audit_log(doctor_id, created_at);

create table if not exists patient (
  patient_id uuid primary key default gen_random_uuid(),
  anonymized_code text unique,
  enc_payload bytea not null,
  enc_payload_iv bytea not null,
  enc_payload_tag bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists patient_key (
  patient_id uuid not null references patient(patient_id) on delete cascade,
  doctor_id uuid not null references doctor(doctor_id) on delete cascade,
  wrapping_scheme text not null,
  dek_enc bytea not null,
  dek_iv bytea not null,
  dek_tag bytea not null,
  primary key (patient_id, doctor_id)
);

create table if not exists patient_access (
  doctor_id uuid references doctor(doctor_id) on delete cascade,
  patient_id uuid references patient(patient_id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  granted_by uuid references doctor(doctor_id),
  granted_at timestamptz not null default now(),
  primary key (doctor_id, patient_id)
);

create table if not exists ecg_scan (
  scan_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(patient_id) on delete cascade,
  storage_uri text not null,
  mimetype text not null,
  uploaded_by uuid references doctor(doctor_id),
  uploaded_at timestamptz not null default now(),
  checksum text,
  metadata jsonb
);
create index if not exists idx_scan_patient_time on ecg_scan(patient_id, uploaded_at);

create table if not exists ml_result (
  result_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(patient_id) on delete cascade,
  scan_id uuid references ecg_scan(scan_id) on delete set null,
  model_version text not null,
  predicted_label text not null,
  class_probs jsonb not null,
  explanation_uri text,
  threshold numeric(5,4) not null,
  created_by uuid references doctor(doctor_id),
  created_at timestamptz not null default now()
);
create index if not exists idx_ml_patient_time on ml_result(patient_id, created_at);

create table if not exists draft (
  draft_id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctor(doctor_id) on delete cascade,
  patient_id uuid references patient(patient_id) on delete cascade,
  form_type text not null,
  enc_payload bytea not null,
  enc_payload_iv bytea not null,
  enc_payload_tag bytea not null,
  updated_at timestamptz not null default now()
);
