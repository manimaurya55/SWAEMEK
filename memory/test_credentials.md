# Test Credentials for EduCore

## Demo Institute
- Name: EduCore Demo Institute
- Code: `DEMO-EDU`

## Seeded Super Admin (Platform Owner / Website Owner)
- Email: `owner@educore.io`
- Password: `Owner@123`
- Role: `superadmin` (access to /super-admin panel only, manages all institutes)

## Seeded Institute Admin (Demo Institute Head)
- Email: `admin@educore.io`
- Password: `Admin@123`
- Role: `admin`

## Auth endpoints (prefix: `/api`)
- POST `/api/auth/register` (fields: email, password, name, role, institute_code, institute_name, department_id, phone, extra)
- POST `/api/auth/login` (email, password)
- GET `/api/auth/me`
- POST `/api/auth/logout`

## Test Users (register these during testing)
Use institute_code `DEMO-EDU` for all non-admin registrations.
- HOD: `hod1@educore.io` / `Hod@123`
- Teacher: `teacher1@educore.io` / `Teacher@123`
- Student: `student1@educore.io` / `Student@123`
- Parent: `parent1@educore.io` / `Parent@123`

## PDF Upload default student password
- `Student@123`
