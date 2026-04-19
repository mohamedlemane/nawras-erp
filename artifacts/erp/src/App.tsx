import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";

// Billing
import Partners from "@/pages/billing/partners";
import PartnerDetail from "@/pages/billing/partner-detail";
import Products from "@/pages/billing/products";
import Quotes from "@/pages/billing/quotes";
import QuoteDetail from "@/pages/billing/quote-detail";
import Proformas from "@/pages/billing/proformas";
import ProformaDetail from "@/pages/billing/proforma-detail";
import Invoices from "@/pages/billing/invoices";
import InvoiceDetail from "@/pages/billing/invoice-detail";
import Payments from "@/pages/billing/payments";

// HR
import Employees from "@/pages/hr/employees";
import EmployeeDetail from "@/pages/hr/employee-detail";
import Departments from "@/pages/hr/departments";
import Positions from "@/pages/hr/positions";
import Contracts from "@/pages/hr/contracts";
import Leaves from "@/pages/hr/leaves";
import Attendances from "@/pages/hr/attendances";
import Documents from "@/pages/hr/documents";

// Projects
import Consultations from "@/pages/projects/consultations";
import ProjectsList from "@/pages/projects/projects";
import ProjectDetail from "@/pages/projects/project-detail";
import ProjectSettings from "@/pages/projects/settings";

// Admin
import Users from "@/pages/admin/users";
import Roles from "@/pages/admin/roles";
import Companies from "@/pages/admin/companies";
import AuditLogs from "@/pages/admin/audit-logs";
import Onboarding from "@/pages/onboarding";

// Expenses
import Expenses from "@/pages/expenses/expenses";
import ExpenseTypes from "@/pages/expenses/expense-types";

// Settings
import CompanySettings from "@/pages/settings/company";
import Integrations from "@/pages/settings/integrations";

const queryClient = new QueryClient();

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="*">
        <Layout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            
            <Route path="/billing/partners" component={Partners} />
            <Route path="/billing/partners/:id" component={PartnerDetail} />
            <Route path="/billing/products" component={Products} />
            <Route path="/billing/quotes" component={Quotes} />
            <Route path="/billing/quotes/:id" component={QuoteDetail} />
            <Route path="/billing/proformas" component={Proformas} />
            <Route path="/billing/proformas/:id" component={ProformaDetail} />
            <Route path="/billing/invoices" component={Invoices} />
            <Route path="/billing/invoices/:id" component={InvoiceDetail} />
            <Route path="/billing/payments" component={Payments} />
            
            <Route path="/hr/employees" component={Employees} />
            <Route path="/hr/employees/:id" component={EmployeeDetail} />
            <Route path="/hr/departments" component={Departments} />
            <Route path="/hr/positions" component={Positions} />
            <Route path="/hr/contracts" component={Contracts} />
            <Route path="/hr/leaves" component={Leaves} />
            <Route path="/hr/attendances" component={Attendances} />
            <Route path="/hr/documents" component={Documents} />

            <Route path="/projects/consultations" component={Consultations} />
            <Route path="/projects/list" component={ProjectsList} />
            <Route path="/projects/settings" component={ProjectSettings} />
            <Route path="/projects/:id" component={ProjectDetail} />

            <Route path="/admin/users" component={Users} />
            <Route path="/admin/roles" component={Roles} />
            <Route path="/admin/companies" component={Companies} />
            <Route path="/admin/audit-logs" component={AuditLogs} />

            <Route path="/expenses" component={Expenses} />
            <Route path="/expenses/types" component={ExpenseTypes} />

            <Route path="/settings/company" component={CompanySettings} />
            <Route path="/settings/integrations" component={Integrations} />

            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
