import React from "react";

const StickyDownloadButton = () => {
  const handleDownload = () => {
    // Actual download implementation
    const brochureUrl = "/brochure.pdf"; // Update with your file path
    const link = document.createElement("a");
    link.href = brochureUrl;
    link.download = "company-brochure.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={handleDownload}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 active:scale-95 transform hover:shadow-xl"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download Brochure
      </button>
    </div>
  );
};

export default StickyDownloadButton;