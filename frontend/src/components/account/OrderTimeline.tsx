import { AlertTriangle, Check, CircleDot } from "lucide-react";
import type { OrderTracking } from "@/features/account/tracking";
import { formatDate } from "./ui";

/**
 * Step-based order timeline. Completed steps carry a check, the current
 * step the brand red, upcoming steps stay grey; the connecting line is
 * filled up to the current step. Each step states its time only when the
 * order record has one — nothing here is estimated or live. Steps appear
 * one after another once (timeline-step in globals.css); that is a page
 * entrance, not progress, and is off under reduced motion.
 */
export function OrderTimeline({ tracking, compact = false }: { tracking: OrderTracking; compact?: boolean }) {
  return (
    <div>
      {tracking.exceptions.map((exception) => (
        <div
          key={exception.key}
          role="status"
          className="mb-4 flex items-start gap-3 rounded-xl bg-[#fdecec] px-4 py-3 text-sm text-[#8f1016]"
        >
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{exception.title}</p>
            <p className="text-[13px]">{exception.description}</p>
          </div>
        </div>
      ))}
      <ol aria-label="Order progress">
        {tracking.steps.map((step, index) => {
          const last = index === tracking.steps.length - 1;
          const done = step.state === "completed";
          const current = step.state === "current";
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              className="timeline-step relative flex gap-3.5 pb-5 last:pb-0"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              {!last ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 rounded-full ${done ? "bg-[#17743a]" : "bg-[var(--color-light-grey)]"}`}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  done
                    ? "bg-[#17743a] text-white"
                    : current
                      ? "bg-[var(--color-action-red)] text-white shadow-[0_0_0_5px_rgba(215,25,32,0.14)]"
                      : "border-2 border-[var(--color-light-grey)] bg-white text-[var(--text-muted)]"
                }`}
              >
                {done ? <Check size={16} strokeWidth={3} /> : current ? <CircleDot size={16} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <div className="min-w-0 pt-1">
                <p className={`text-sm font-semibold ${current ? "text-[var(--color-action-red)]" : done ? "" : "text-[var(--text-secondary)]"}`}>
                  {step.title}
                  <span className="sr-only"> — {done ? "completed" : current ? "current step" : "not yet reached"}</span>
                </p>
                {!compact ? (
                  <>
                    <p className={`mt-0.5 text-[13px] ${done || current ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}>
                      {step.description}
                    </p>
                    {step.at ? (
                      <p className="mt-0.5 text-xs tabular-nums text-[var(--text-muted)]">{formatDate(step.at, true)}</p>
                    ) : done || current ? (
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">Time not recorded</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
