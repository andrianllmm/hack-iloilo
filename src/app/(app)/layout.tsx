import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/modules/accounts/auth";
import { NotificationLoader } from "@/modules/notifications/components/notification-loader";

async function StaffShell({ children }: { children: React.ReactNode }) {
  const staff = await requireRole();

  return (
    <SidebarProvider>
      <AppSidebar staff={staff} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="ml-auto">
            <Suspense fallback={<Skeleton className="h-8 w-12" />}>
              <NotificationLoader />
            </Suspense>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}
