import React, { useEffect, useMemo, useState } from "react";

import { AnalyticsPanels, EventBlockGrid, EventDetailDialog } from "../DashboardSections.jsx";
import { TimelineRangeSelector } from "../shared/TimelineRangeControls.jsx";
import { buildMobileHourTicks, buildMobileRecentWeekTimeline, formatRangeSelection } from "../../lib/dashboard-helpers.js";
import { getTimelineText } from "../../../infra/i18n/timeline-locale.js";

function MobileDashboardView({
  activeDetail,
  categories,
  categoryDetail,
  chartAxisStroke,
  chartGridStroke,
  currentAggregate,
  currentKey,
  currentTimeline,
  data,
  locale,
  range,
  selectedCategoryId,
  selectedDate,
  selectedMonth,
  selectedSubcategoryId,
  setRange,
  setSelectedDate,
  setSelectedMonth,
  selectCategory,
  selectSubcategory,
  styledSubcategories,
}) {
  const [activeTab, setActiveTab] = useState("timeline");
  const timelineDays = useMemo(() => buildMobileRecentWeekTimeline(data, locale, selectedDate), [data, locale, selectedDate]);
  const [activeDayKey, setActiveDayKey] = useState("");

  useEffect(() => {
    const nextActiveDayKey = timelineDays.some((day) => day.date === selectedDate) ? selectedDate : "";
    setActiveDayKey(nextActiveDayKey);
  }, [selectedDate, timelineDays]);

  return (
    <main className="page page-mobile">
      <section className="mobile-shell">
        <header className="mobile-header">
          <div className="mobile-header-copy">
            <h1 className="mobile-title">Personal Timeline</h1>
          </div>
          <nav className="pill-group mobile-tab-group" aria-label={getTimelineText(locale, "selectTimeRange")}>
            <MobileTabButton active={activeTab === "timeline"} onClick={() => setActiveTab("timeline")}>
              Timeline
            </MobileTabButton>
            <MobileTabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
              Analytics
            </MobileTabButton>
            <MobileTabButton active={activeTab === "events"} onClick={() => setActiveTab("events")}>
              Events
            </MobileTabButton>
          </nav>
          <div className="mobile-range-row">
            <nav className="pill-group mobile-unit-group" aria-label={getTimelineText(locale, "selectTimeRange")}>
              <MobileTabButton active={activeTab !== "timeline" && range === "day"} disabled={activeTab === "timeline"} onClick={() => setRange("day")}>
                Day
              </MobileTabButton>
              <MobileTabButton active={activeTab === "timeline" || range === "week"} disabled={activeTab === "timeline"} onClick={() => setRange("week")}>
                Week
              </MobileTabButton>
              <MobileTabButton active={activeTab !== "timeline" && range === "month"} disabled={activeTab === "timeline"} onClick={() => setRange("month")}>
                Month
              </MobileTabButton>
            </nav>
            <TimelineRangeSelector
              range={activeTab === "timeline" ? "week" : range}
              selectedDate={selectedDate}
              selectedWeek={selectedDate}
              selectedMonth={selectedMonth}
              onDateChange={setSelectedDate}
              onWeekChange={setSelectedDate}
              onMonthChange={setSelectedMonth}
              data={data}
              locale={locale}
              weekRangeMode="rolling"
            />
          </div>
          {activeTab === "timeline" && timelineDays.length && activeDayKey ? (
            <MobileTimelineHeader activeDayKey={activeDayKey} days={timelineDays} onSelectDay={setActiveDayKey} />
          ) : null}
        </header>
        <div className="mobile-content">
          {activeTab === "timeline" ? (
            <MobileTimelineView
              activeDayKey={activeDayKey}
              days={timelineDays}
              locale={locale}
              onSelectDay={setActiveDayKey}
            />
          ) : null}

          {activeTab === "analytics" ? (
            <AnalyticsPanels
              activeDetail={activeDetail}
              categories={categories}
              categoryDetail={categoryDetail}
              chartAxisStroke={chartAxisStroke}
              chartGridStroke={chartGridStroke}
              currentAggregate={currentAggregate}
              currentRangeLabel={formatRangeSelection(range, currentKey, locale) || getTimelineText(locale, "notSelected")}
              enablePcTargets={false}
              includeEvents={false}
              isCompact
              locale={locale}
              selectedCategoryId={selectedCategoryId}
              selectedSubcategoryId={selectedSubcategoryId}
              styledSubcategories={styledSubcategories}
              onCategorySelect={selectCategory}
              onSubcategorySelect={selectSubcategory}
            />
          ) : null}

          {activeTab === "events" ? (
            <MobileEventsView activeDetail={activeDetail} locale={locale} />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function MobileTabButton({ active, children, disabled = false, onClick }) {
  return (
    <button type="button" className="pill mobile-tab" data-on={active} disabled={disabled} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  );
}

function MobileTimelineHeader({ activeDayKey, days, onSelectDay }) {
  return (
    <div className="mobile-week-header">
      <div className="mobile-week-header-spacer" aria-hidden="true" />
      {days.map((day) => {
        const isActive = day.date === activeDayKey;
        return (
          <button
            key={`head:${day.date}`}
            type="button"
            className={`mobile-day-header ${isActive ? "active" : "compact"}`.trim()}
            onClick={() => onSelectDay(day.date)}
          >
            <span>{day.weekday}</span>
            <strong>{isActive ? day.label : day.compactDay}</strong>
          </button>
        );
      })}
    </div>
  );
}

function MobileTimelineView({ activeDayKey, days, locale, onSelectDay }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const hourTicks = useMemo(() => buildMobileHourTicks(), []);
  return (
    <section className="mobile-stack-section">
      {days.length && activeDayKey ? (
        <div className="mobile-week-shell">
          <div className="mobile-week-strip">
            <div className="mobile-time-axis">
              {hourTicks.map((tick) => (
                <div key={tick.key} className="mobile-time-tick" style={{ top: `${tick.top}%` }}>
                  <span>{tick.label}</span>
                </div>
              ))}
            </div>
            <div className="mobile-time-grid" aria-hidden="true">
              {hourTicks.map((tick) => (
                <div key={tick.key} className="mobile-time-grid-line" style={{ top: `${tick.top}%` }} />
              ))}
            </div>
            {days.map((day) => {
              const isActive = day.date === activeDayKey;
              return (
                <button
                  key={day.date}
                  type="button"
                  className={`mobile-day-column ${isActive ? "active" : "compact"}`.trim()}
                  onClick={() => onSelectDay(day.date)}
                >
                  <div className="mobile-day-track">
                    {day.items.map((item) => (
                      <div
                        key={item.id}
                        className={buildMobileDayEventClassName(item.height)}
                        onClick={isActive ? (eventObject) => {
                          eventObject.stopPropagation();
                          setSelectedEvent({
                            label: item.title,
                            dateLabel: day.label,
                            timeLabel: item.timeText,
                            compactDuration: item.durationText,
                            note: item.note,
                          });
                        } : undefined}
                        style={{
                          "--mobile-item-fill": item.color,
                          "--mobile-item-ink": item.ink,
                          top: `${item.top}%`,
                          height: `${item.height}%`,
                        }}
                      >
                        {isActive ? (
                          <div className="mobile-day-event-body">
                            <div className="mobile-day-event-head">
                              <h2>{item.title}</h2>
                            </div>
                            <p>{item.timeText}</p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="panel empty-state">{getTimelineText(locale, "noTimeline")}</div>
      )}
      {selectedEvent ? (
        <EventDetailDialog event={selectedEvent} ink="var(--ink)" locale={locale} onClose={() => setSelectedEvent(null)} />
      ) : null}
    </section>
  );
}

function buildMobileDayEventClassName(heightPercent) {
  const value = Number(heightPercent || 0);
  if (value >= 8.4) {
    return "mobile-day-event mobile-day-event-tall";
  }
  return "mobile-day-event mobile-day-event-tight";
}

function MobileEventsView({ activeDetail, locale }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <section className="mobile-stack-section">
      <div className="panel chart-panel event-panel">
        <div className="panel-header">
          <div className="panel-title-group">
            <h2>{getTimelineText(locale, "events")}</h2>
            {activeDetail ? (
              <span className="panel-context-pill" style={{ "--context-fill": activeDetail.color, "--context-ink": activeDetail.ink }}>
                {activeDetail.label}
              </span>
            ) : null}
          </div>
        </div>
        {activeDetail?.events?.length ? (
          <EventBlockGrid
            events={activeDetail.events}
            color={activeDetail.color}
            ink={activeDetail.ink}
            compact
            onEventSelect={setSelectedEvent}
          />
        ) : (
          <div className="empty-state small">{getTimelineText(locale, "noEventDetails")}</div>
        )}
      </div>
      {selectedEvent ? (
        <EventDetailDialog event={selectedEvent} ink={activeDetail?.ink || "var(--ink)"} locale={locale} onClose={() => setSelectedEvent(null)} />
      ) : null}
    </section>
  );
}

export { MobileDashboardView };
