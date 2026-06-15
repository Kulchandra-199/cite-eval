"use client";

import { useParams, useRouter } from "next/navigation";
import ReportDetail from "@/components/ReportDetail";
import { useReports } from "@/context/ReportsContext";

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const {
    getReport,
    handleUpdateFact,
    handleBulkUpdateFacts,
    handleReRunSingleFact,
  } = useReports();

  const report = getReport(id);

  if (!report) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Report not found</h2>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm font-medium text-indigo-600 hover:underline"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  return (
    <ReportDetail
      report={report}
      onBack={() => router.push("/")}
      onUpdateFact={(factId, updates) => handleUpdateFact(id, factId, updates)}
      onBulkUpdate={(factIds, updates) =>
        handleBulkUpdateFacts(id, factIds, updates)
      }
      onReRunFact={(factId) => handleReRunSingleFact(id, factId)}
    />
  );
}
