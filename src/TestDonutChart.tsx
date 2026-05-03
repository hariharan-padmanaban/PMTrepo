import { useState } from 'react';
import { DonutChart } from './DonutChart';

export function TestDonutChart() {
  const [testMode, setTestMode] = useState(false);

  if (!testMode) {
    return (
      <button
        onClick={() => setTestMode(true)}
        className="fixed bottom-4 right-4 px-4 py-2 text-xs font-semibold bg-blue-500 text-white rounded-md hover:bg-blue-600 z-50"
      >
        Test Chart
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Donut Chart Test Screen</h2>
          <button
            onClick={() => setTestMode(false)}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Test Chart 1: Large Donut */}
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-sm font-semibold text-gray-700">Large Donut (h-96 w-96)</h3>
              <div className="flex items-center justify-center">
                <DonutChart
                  className="h-96 w-96 chart-svg"
                  ringWidth={48}
                  slices={[
                    { label: 'Finance', value: 450000, color: '#1667de' },
                    { label: 'Operations', value: 320000, color: '#3b3a80' },
                    { label: 'Marketing', value: 280000, color: '#d3525a' },
                    { label: 'HR', value: 150000, color: '#fbbf24' },
                  ]}
                  centerText="1,200K"
                  centerSubtext="total budget"
                  labelColor="#64748b"
                  showOuterLabels={true}
                />
              </div>
              <p className="text-[10px] text-gray-500 text-center">
                Hover over segments to see animation
              </p>
            </div>

            {/* Test Chart 2: Medium Donut */}
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-sm font-semibold text-gray-700">Medium Donut (h-48 w-48)</h3>
              <div className="flex items-center justify-center">
                <DonutChart
                  className="h-48 w-48 chart-svg"
                  ringWidth={42}
                  slices={[
                    { label: 'On Track', value: 12, color: '#1667de' },
                    { label: 'Delayed', value: 5, color: '#d3525a' },
                    { label: 'Completed', value: 18, color: '#10b981' },
                  ]}
                  centerText="35"
                  centerSubtext="projects"
                  labelColor="#64748b"
                  showOuterLabels={false}
                />
              </div>
              <p className="text-[10px] text-gray-500 text-center">
                No outer labels, compact display
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-xs font-semibold text-blue-900 mb-2">✓ What to verify:</h4>
            <ul className="text-[10px] text-blue-800 space-y-1">
              <li>• Donut segments are smooth and colorful</li>
              <li>• Hover any segment to see it push outward (animation)</li>
              <li>• Center text displays correctly</li>
              <li>• Outer labels show with values (left chart only)</li>
              <li>• No rendering artifacts or blank charts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
