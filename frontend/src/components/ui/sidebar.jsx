import * as React from "react"
import { Link, useLocation } from "react-router"
import { Home, Trash2, Crown, KeyRound } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const user = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("todo-user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="text-purple-600">Kaito</span> Todo
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2">
          {/* Trang chủ */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentPath === "/"} tooltip="Home">
              <Link to="/">
                <Home />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Trang Premium */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentPath === "/premium"} tooltip="Premium">
              <Link to="/premium">
                <Crown />
                <span>Premium</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Thùng rác */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={currentPath === "/trash"} tooltip="Trash">
              <Link to="/trash">
                <Trash2 />
                <span>Trash</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarSeparator className="my-2" />
          {user?.email === "kaitomuzicvn@gmail.com" && (
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={currentPath === "/invite/create"} 
                tooltip="Tạo mã Premium"
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/50"
              >
                <Link to="/invite/create">
                  <KeyRound />
                  <span className="font-semibold">Tạo mã Premium</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4">
      </SidebarFooter>
    </Sidebar>
  )
}