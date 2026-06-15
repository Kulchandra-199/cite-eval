"use client";

import ReportList from "@/components/ReportList";
import { useReports } from "@/context/ReportsContext";

export default function HomePage() {
  const {
    reports,
    handleViewReport,
    handleDeleteReport,
    handleReRunReport,
    handleCreateNewClick,
  } = useReports();

  return (
    <ReportList
      reports={reports}
      onViewReport={handleViewReport}
      onDeleteReport={handleDeleteReport}
      onReRunReport={handleReRunReport}
      onCreateNewClick={handleCreateNewClick}
    />
  );
}
