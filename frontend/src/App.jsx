import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import MasterData from "./pages/MasterData";
import Items from "./pages/Items";
import ItemDetail from "./pages/ItemDetail";
import Transactions from "./pages/Transactions";
import TransactionForm from "./pages/TransactionForm";
import StockOpname from "./pages/StockOpname";
import Catalog from "./pages/Catalog";
import MyRequests from "./pages/MyRequests";
import ManageRequests from "./pages/ManageRequests";
import Reports from "./pages/Reports";
import ActivityLogs from "./pages/ActivityLogs";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const MANAGERS = ["super_admin", "staff"];

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="loading">Memeriksa sesi…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

/** Proteksi di sisi UI. Backend tetap memeriksa peran di setiap endpoint. */
function RoleRoute({ roles, children }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) {
    return (
      <div className="panel"><div className="empty">
        <strong>Halaman ini tidak tersedia untuk peran Anda</strong>
        Hubungi Super Admin bila Anda memerlukan akses.
      </div></div>
    );
  }
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="requests/mine" element={<MyRequests />} />
        <Route path="requests/manage" element={<RoleRoute roles={MANAGERS}><ManageRequests /></RoleRoute>} />
        <Route path="items" element={<RoleRoute roles={MANAGERS}><Items /></RoleRoute>} />
        <Route path="items/:id" element={<RoleRoute roles={MANAGERS}><ItemDetail /></RoleRoute>} />
        <Route path="transactions" element={<RoleRoute roles={MANAGERS}><Transactions /></RoleRoute>} />
        <Route path="transactions/new/:type" element={<RoleRoute roles={MANAGERS}><TransactionForm /></RoleRoute>} />
        <Route path="stock-opname" element={<RoleRoute roles={MANAGERS}><StockOpname /></RoleRoute>} />
        <Route path="master" element={<RoleRoute roles={MANAGERS}><MasterData /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={MANAGERS}><Reports /></RoleRoute>} />
        <Route path="users" element={<RoleRoute roles={["super_admin"]}><Users /></RoleRoute>} />
        <Route path="activity-logs" element={<RoleRoute roles={["super_admin"]}><ActivityLogs /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute roles={["super_admin"]}><Settings /></RoleRoute>} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
