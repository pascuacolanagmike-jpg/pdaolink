# PDAOLink — PWD Digital Registration and Management System

A modern web application for the **Persons with Disability Affairs Office (PDAO)**. Applicants register online, submit PWD applications, upload documents, and track status. Administrators review applications, manage statuses, publish announcements, and generate reports.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Bootstrap 5, Bootstrap Icons
- **Backend / Database / Auth / Storage:** Supabase (PostgreSQL, Row Level Security, Storage bucket for uploads)
- **Charts:** Chart.js + react-chartjs-2
- **Reports:** jsPDF + jspdf-autotable (PDF), SheetJS/xlsx (Excel)

## Features

### Client
- Register / login securely (with "Remember me")
- Edit profile, change password, forgot-password reset
- Submit PWD application (personal, PWD, emergency, representative, government IDs)
- Upload documents (PDF/JPG/JPEG/PNG, max 10 MB) to Supabase Storage
- Track application status with a full status timeline
- View announcements and notifications
- Download own uploaded documents

### Admin
- Dashboard with statistics, doughnut chart, recent activity, recent applicants
- Search and filter applicants (by ID, name, email, disability type, status)
- Review applicant profile, submitted forms, and uploaded files
- Update application status (Approve / Reject / Request Revision / Ready for Pickup) with remarks
- Status changes notify the client and log to an audit trail
- Create, edit, pin, expire, and delete announcements (clients get notified)
- Generate and export reports (all / daily / monthly / approved / rejected) to PDF and Excel

### Application statuses
`Pending` → `Under Review` → `Needs Revision` / `Approved` / `Rejected` → `Ready for Pickup`

## Getting Started

```bash
npm install
npm run dev      # development
npm run build    # production build
```

## Default Admin Account
- **Email:** `admin@pdaolink.gov.ph`
- **Password:** `Admin@12345`

Created automatically by the `seed-admin` edge function on first invocation.

## Project Structure
```
src/
├── components/      # shared UI (AppLayout, Alert)
├── lib/             # supabase client, auth context, types, nav, report export
├── pages/
│   ├── public/      # landing page
│   ├── auth/        # login, register, forgot password
│   ├── client/      # dashboard, application, upload, status, announcements, notifications, profile, change password
│   └── admin/       # dashboard, applicants, applicant detail, announcements, reports
├── styles.css
├── App.tsx          # router with role-protected routes
└── main.tsx
supabase/
└── functions/
    └── seed-admin/  # edge function to provision the default admin
```

## Security
- Supabase Auth (email/password) with bcrypt-hashed credentials
- Row Level Security on every table
- Clients can only access their own data; admins see all applications
- File uploads validated by type and size; stored per-user in Supabase Storage
- Role-based route protection (client vs admin) in the frontend
