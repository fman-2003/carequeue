"use client";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean; // red confirm button for destructive actions
}

export default function ConfirmModal({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm mx-4">
        <h3 className="font-bold text-gray-800 text-base mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded text-white font-medium transition ${
              danger
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
