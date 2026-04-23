import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'

import Dashboard     from './pages/Dashboard'
import MemberList    from './pages/members/MemberList'
import MemberDetail  from './pages/members/MemberDetail'
import MemberForm    from './pages/members/MemberForm'
import Communities   from './pages/communities/Communities'
import CommunityDetail from './pages/communities/CommunityDetail'
import Attendance    from './pages/attendance/Attendance'
import AttendanceQR  from './pages/attendance/AttendanceQR'
import AttendanceStats from './pages/attendance/AttendanceStats'
import Offering        from './pages/offering/Offering'
import OfferingInput   from './pages/offering/OfferingInput'
import OfferingHistory from './pages/offering/OfferingHistory'
import OfferingReceipt from './pages/offering/OfferingReceipt'
import Budget        from './pages/budget/Budget'
import BudgetReport  from './pages/budget/BudgetReport'
import Pastoral      from './pages/pastoral/Pastoral'
import CalendarPage  from './pages/calendar/CalendarPage'
import Departments   from './pages/departments/Departments'
import DepartmentDetail from './pages/departments/DepartmentDetail'
import Messenger     from './pages/messenger/Messenger'
import SMS           from './pages/sms/SMS'
import Directory     from './pages/directory/Directory'
import Organization  from './pages/organization/Organization'
import Settings      from './pages/settings/Settings'

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<MemberList />} />
          <Route path="members/new" element={<MemberForm />} />
          <Route path="members/:id" element={<MemberDetail />} />
          <Route path="members/:id/edit" element={<MemberForm />} />
          <Route path="communities" element={<Communities />} />
          <Route path="communities/:id" element={<CommunityDetail />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance/qr" element={<AttendanceQR />} />
          <Route path="attendance/stats" element={<AttendanceStats />} />
          <Route path="offering" element={<Offering />} />
          <Route path="offering/input" element={<OfferingInput />} />
          <Route path="offering/history" element={<OfferingHistory />} />
          <Route path="offering/receipt" element={<OfferingReceipt />} />
          <Route path="budget" element={<Budget />} />
          <Route path="budget/report" element={<BudgetReport />} />
          <Route path="pastoral" element={<Pastoral />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="departments" element={<Departments />} />
          <Route path="departments/:id" element={<DepartmentDetail />} />
          <Route path="messenger" element={<Messenger />} />
          <Route path="sms" element={<SMS />} />
          <Route path="directory" element={<Directory />} />
          <Route path="organization" element={<Organization />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
