import ImportForm from "@/components/admin/ImportForm";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <h1>CSV Import</h1>

      {/* Format documentation */}
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold">CSV format</h2>
        <p className="text-sm text-gray-600">
          Each row represents one player&apos;s prediction for one match. The file must have a
          header row with the column names shown below. Column order does not matter.
        </p>

        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border border-gray-200 font-mono font-medium">Column</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-medium">Required</th>
                <th className="text-left px-3 py-2 border border-gray-200 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">username</td>
                <td className="px-3 py-2 border border-gray-200 text-green-700">Yes</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-600">The player&apos;s username (case-insensitive). Must match an existing account.</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">home_team</td>
                <td className="px-3 py-2 border border-gray-200 text-green-700">Yes</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-600">Full team name for the home side (case-insensitive; aliases accepted).</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">away_team</td>
                <td className="px-3 py-2 border border-gray-200 text-green-700">Yes</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-600">Full team name for the away side (case-insensitive; aliases accepted).</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">date</td>
                <td className="px-3 py-2 border border-gray-200 text-green-700">Yes</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-600">Match date in <span className="font-mono">YYYY-MM-DD</span> format (e.g. 2026-06-11). Used to identify the fixture.</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">home_goals</td>
                <td className="px-3 py-2 border border-gray-200 text-green-700">Yes</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-600">Predicted home goals at 90 minutes. Whole number, 0 to 20.</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">away_goals</td>
                <td className="px-3 py-2 border border-gray-200 text-green-700">Yes</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-600">Predicted away goals at 90 minutes. Whole number, 0 to 20.</td>
              </tr>
              <tr>
                <td className="px-3 py-2 border border-gray-200 font-mono text-xs">advancing_team</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-400">Knockout only</td>
                <td className="px-3 py-2 border border-gray-200 text-gray-600">
                  Team name of the predicted winner. Leave blank for group matches.
                  For knockout matches: if the predicted score is decisive, the advancing team is
                  derived automatically. Only required when predicting a draw (e.g. 1-1 after 90 min).
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Example</p>
          <pre className="rounded bg-gray-50 border border-gray-200 p-3 text-xs font-mono overflow-x-auto whitespace-pre">
{`username,home_team,away_team,date,home_goals,away_goals,advancing_team
alice,Mexico,South Africa,2026-06-11,2,0,
bob,USA,England,2026-06-17,1,2,
charlie,Brazil,Argentina,2026-07-02,1,1,Brazil`}
          </pre>
        </div>

        <div className="rounded bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
          <p><strong>Notes:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Import bypasses prediction locks: you can back-enter predictions for locked or finished matches.</li>
            <li>If a result already exists for a match, the imported prediction is scored immediately.</li>
            <li>Re-importing the same row overwrites the previous prediction (safe to re-run).</li>
            <li>Rows with errors are skipped; valid rows in the same file still import.</li>
          </ul>
        </div>
      </div>

      {/* Upload form */}
      <div className="card p-6 space-y-3">
        <h2 className="text-base font-semibold">Upload CSV</h2>
        <ImportForm />
      </div>
    </div>
  );
}
