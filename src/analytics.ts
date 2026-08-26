import type { Mixpanel } from "mixpanel-browser";

type MixpanelEventProperties = {
  page_viewed: {
    page_path: string;
    platform: "web";
  };
  outbound_link_clicked: {
    link_name: string;
    link_category: "backer" | "experience" | "social";
    is_primary: false;
  };
};

const projectToken = import.meta.env.VITE_MIXPANEL_TOKEN;
const analyticsEnabled =
  import.meta.env.PROD && typeof projectToken === "string" && projectToken.length > 0;

let mixpanelPromise: Promise<Mixpanel | null> | null = null;

function loadMixpanel(): Promise<Mixpanel | null> {
  if (!analyticsEnabled) return Promise.resolve(null);
  if (mixpanelPromise) return mixpanelPromise;

  mixpanelPromise = import("mixpanel-browser")
    .then(({ default: mixpanel }) => {
      mixpanel.init(projectToken, {
        autocapture: false,
        debug: false,
        ip: false,
        persistence: "localStorage",
        record_heatmap_data: false,
        record_sessions_percent: 0,
        stop_utm_persistence: true,
        track_pageview: false,
      });
      return mixpanel;
    })
    .catch((error: unknown) => {
      console.error("Mixpanel failed to initialize.", error);
      return null;
    });

  return mixpanelPromise;
}

export function trackMixpanelEvent<EventName extends keyof MixpanelEventProperties>(
  eventName: EventName,
  properties: MixpanelEventProperties[EventName],
): void {
  void loadMixpanel().then((mixpanel) => {
    mixpanel?.track(eventName, properties);
  });
}
