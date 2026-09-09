import { HomeAnalytics } from "@/components/dashboard/home-analytics";
import type { DashboardBoard } from "@/lib/dashboard/board";

type HomeDashboardProps = {
  organizationName: string;
  board: DashboardBoard;
  canUseInbox: boolean;
};

export const HomeDashboard = ({ organizationName, board, canUseInbox }: HomeDashboardProps) => (
  <HomeAnalytics
    organizationName={organizationName}
    board={board}
    canUseInbox={canUseInbox}
  />
);
