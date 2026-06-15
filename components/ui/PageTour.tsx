/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TourStep {
  title: string;
  content: string;
}

interface Props {
  tourId: string;
  steps: TourStep[];
  role?: string; // optional — only show tour for specific role
}

export default function PageTour({ tourId, steps, role }: Props) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    /**
     * Check localStorage to see if this tour has been seen.
     * If not, show it after a short delay so the page
     * has time to render first.
     */
    const seen = localStorage.getItem(`tour_${tourId}`);
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tourId]);

  function dismiss() {
    localStorage.setItem(`tour_${tourId}`, "seen");
    setVisible(false);
  }

  function next() {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-900/30 backdrop-blur-[2px] z-40"
            onClick={dismiss}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-8 right-8 z-50 w-80 card p-5 shadow-strong bg-primary-500 text-white"
          >
            <div className="flex gap-1.5 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? "bg-primary flex-1"
                      : i < currentStep
                        ? "bg-primary/40 w-4"
                        : "bg-neutral-200 w-4"
                  }`}
                />
              ))}
            </div>      
            <div className="mb-5">
              <h3 className="font-semibold text-white mb-1.5">
                {step.title}
              </h3>
              <p className="text-sm text-neutral-100 leading-relaxed">
                {step.content}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={dismiss}
                className="text-xs text-neutral-200 hover:text-neutral-100 transition-colors"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">
                  {currentStep + 1} of {steps.length}
                </span>
                <button
                  onClick={next}
                  className="btn-primary text-xs py-1.5 px-4"
                >
                  {currentStep < steps.length - 1 ? "Next →" : "Got it!"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
