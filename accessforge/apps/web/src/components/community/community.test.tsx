import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LostItem, Member, Session } from "@/lib/community-api";
import { axeViolations } from "@/test/axe";
import { fakeMapControl, resetFakeMaplibre } from "@/test/fake-maplibre";
import { AccountPanel } from "./AccountPanel";
import { IncidentForm } from "./IncidentForm";
import { IncidentsExplorer } from "./IncidentsExplorer";
import { LostFoundList } from "./LostFoundList";
import { LostItemDetail } from "./LostItemDetail";
import { LostItemForm } from "./LostItemForm";
import { NotificationsList } from "./NotificationsList";
import { UpdatesList } from "./UpdatesList";

vi.mock("maplibre-gl", () => import("@/test/fake-maplibre"));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const MEMBER: Member = {
  name: "Ana Ruiz",
  email: "ana@example.com",
  zip: "94110",
  phone: null,
  notify_email: true,
  notify_sms: false,
  notify_whatsapp: false,
  notify_telegram: false,
  telegram_connected: false,
  has_password: true,
};
const session = (user: Member | null): Session => ({
  user,
  unread: 0,
  channels: { email: true, sms: false, whatsapp: false, telegram: true },
  google_enabled: false,
  categories: { fire: "Fire", other: "Other" },
  item_categories: ["Pet", "Keys"],
});
const ITEM: LostItem = {
  id: 7,
  kind: "lost",
  title: "Brown dog",
  category: "Pet",
  description: "Answers to Max",
  zip: "94110",
  place: "Dolores Park",
  seen_on: null,
  image_url: "/static/uploads/max.jpg",
  lat: 37.75,
  lng: -122.42,
  radius_m: 300,
  status: "open",
  created_at: null,
  poster: "Ben",
  is_mine: false,
};

type Route = { method?: string; path: string; status?: number; body: unknown };
/** Answers each request with the first matching route; later routes win for repeats. */
function serve(...routes: Route[]) {
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    const route = [...routes]
      .reverse()
      .find((r) => url === `/api/community${r.path}` && (r.method ?? "GET") === method);
    if (!route) return Response.json({ error: `No route for ${method} ${url}` }, { status: 404 });
    return Response.json(route.body, { status: route.status ?? 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const sent = (fetch: ReturnType<typeof serve>, path: string) =>
  fetch.mock.calls.find(([url, init]) => url === `/api/community${path}` && init.method !== "GET");

beforeEach(() => {
  resetFakeMaplibre();
  push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("IncidentsExplorer", () => {
  it("lists every post with a map marker and filters by layer", async () => {
    serve({
      path: "/map",
      body: [
        {
          id: "report-1",
          kind: "report",
          category: "fire",
          title: "Fire",
          description: "Smoke on 24th",
          zip: "94110",
          lat: 37.7,
          lng: -122.4,
          image: null,
          resolved: false,
          source: "news",
          sourceUrl: "https://news.example/a",
          sourceName: "SF News",
          created: null,
        },
        {
          id: "item-7",
          kind: "lost",
          category: "lost_item",
          title: "Brown dog",
          description: "Max",
          zip: "94110",
          lat: 37.75,
          lng: -122.42,
          image: null,
          resolved: false,
          source: "community",
          url: "/lost-found/7",
          created: null,
        },
      ],
    });
    const { container } = render(<IncidentsExplorer />);
    expect(await screen.findByText("2 posts on the map.")).toBeVisible();
    await waitFor(() => expect(fakeMapControl.instances).toHaveLength(1));
    fakeMapControl.instances[0].emit("load");
    expect(await screen.findByRole("link", { name: "Brown dog, ZIP 94110" })).toHaveAttribute(
      "href",
      "/lost-found/item?id=7",
    );
    expect(screen.getByRole("link", { name: "SF News" })).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);

    await userEvent.setup().click(screen.getByRole("radio", { name: "Lost" }));
    expect(screen.getByText("1 post on the map.")).toBeVisible();
    expect(screen.queryByText("Smoke on 24th")).toBeNull();
  });

  it("asks for resolved posts and offers a retry on failure", async () => {
    const fetch = serve({ path: "/map", status: 500, body: { error: "Database is down." } });
    render(<IncidentsExplorer />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Database is down.");
    serve({ path: "/map?resolved=1", body: [] });
    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Include resolved" }));
    expect(await screen.findByText("0 posts on the map.")).toBeVisible();
    expect(fetch).toHaveBeenCalled();
  });

  it("keeps the list when the map can't start", async () => {
    fakeMapControl.throwOnCreate = true;
    serve({ path: "/map", body: [] });
    render(<IncidentsExplorer />);
    expect(await screen.findByText(/map could not load/)).toBeVisible();
  });
});

describe("IncidentForm", () => {
  it("validates, then sends the report with the device location", async () => {
    const fetch = serve(
      { path: "/me", body: session(MEMBER) },
      { method: "POST", path: "/reports", status: 201, body: { id: 3 } },
    );
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 37.7, longitude: -122.4 } } as GeolocationPosition),
      },
    });
    const user = userEvent.setup();
    const { container } = render(<IncidentForm />);
    await user.click(await screen.findByRole("button", { name: "Send report" }));
    expect(screen.getByText("Choose what happened.")).toBeVisible();
    expect(screen.getByLabelText("ZIP code")).toHaveValue("94110");
    expect(await axeViolations(container)).toEqual([]);

    await user.selectOptions(screen.getByLabelText("What happened?"), "fire");
    await user.type(screen.getByLabelText("Details"), "Smoke");
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByText("37.70000, -122.40000")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByText(/Your report is on the map/)).toBeVisible();
    const body = sent(fetch, "/reports")?.[1].body as FormData;
    expect([body.get("type"), body.get("zip"), body.get("lat")]).toEqual(["fire", "94110", "37.7"]);
  });

  it("asks visitors to sign in first", async () => {
    serve({ path: "/me", body: session(null) });
    render(<IncidentForm />);
    expect(await screen.findByRole("link", { name: /Sign in or create an account/ })).toBeVisible();
    expect(screen.queryByRole("form", { name: "Report an incident" })).toBeNull();
  });

  it("shows the service's refusal", async () => {
    serve(
      { path: "/me", body: session({ ...MEMBER, zip: null }) },
      { method: "POST", path: "/reports", status: 429, body: { error: "Please wait an hour" } },
    );
    vi.stubGlobal("navigator", {});
    const user = userEvent.setup();
    render(<IncidentForm />);
    await user.selectOptions(await screen.findByLabelText("What happened?"), "other");
    await user.type(screen.getByLabelText("Details"), "x");
    await user.type(screen.getByLabelText("ZIP code"), "94110");
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByText(/can't share its location/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please wait an hour");
  });
});

describe("Lost and found", () => {
  it("lists posts and filters by kind and ZIP", async () => {
    const fetch = serve(
      { path: "/lost-found?", body: [ITEM] },
      { path: "/lost-found?kind=found&zip=94103&closed=1", body: [] },
    );
    const user = userEvent.setup();
    const { container } = render(<LostFoundList />);
    expect(await screen.findByRole("link", { name: "Brown dog" })).toHaveAttribute(
      "href",
      "/lost-found/item?id=7",
    );
    expect(await axeViolations(container)).toEqual([]);
    await user.selectOptions(screen.getByLabelText("Show"), "found");
    await user.type(screen.getByLabelText("ZIP code"), "94103");
    await user.click(screen.getByRole("checkbox", { name: "Include reunited" }));
    expect(await screen.findByText(/No posts match/)).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/community/lost-found?kind=found&zip=94103&closed=1",
      expect.anything(),
    );
  });

  it("asks visitors to sign in before posting", async () => {
    serve({ path: "/me", body: session(null) });
    render(<LostItemForm />);
    expect(await screen.findByRole("link", { name: /Sign in or create an account/ })).toBeVisible();
  });

  it("validates a post, sends it and opens the new post", async () => {
    const fetch = serve(
      { path: "/me", body: session(MEMBER) },
      { method: "POST", path: "/lost-found", status: 201, body: ITEM },
    );
    const user = userEvent.setup();
    const { container } = render(<LostItemForm />);
    await user.click(await screen.findByRole("button", { name: "Post and alert neighbors" }));
    expect(screen.getByText("Choose a category.")).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("radio", { name: "I found it" }));
    await user.type(screen.getByLabelText("Title"), "Keys");
    await user.selectOptions(screen.getByLabelText("Category"), "Keys");
    await user.type(screen.getByLabelText("Description"), "Blue ring");
    await user.click(screen.getByRole("button", { name: "Post and alert neighbors" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/lost-found/item?id=7"));
    const body = sent(fetch, "/lost-found")?.[1].body as FormData;
    expect([body.get("kind"), body.get("zip"), body.get("category")]).toEqual([
      "found",
      "94110",
      "Keys",
    ]);
  });

  it("shows a failed post", async () => {
    serve(
      { path: "/me", body: session(MEMBER) },
      {
        method: "POST",
        path: "/lost-found",
        status: 400,
        body: { error: "Please fill in every required field." },
      },
    );
    const user = userEvent.setup();
    render(<LostItemForm />);
    await user.type(await screen.findByLabelText("Title"), "Keys");
    await user.selectOptions(screen.getByLabelText("Category"), "Keys");
    await user.type(screen.getByLabelText("Description"), "Blue ring");
    await user.click(screen.getByRole("button", { name: "Post and alert neighbors" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please fill in every required field.",
    );
  });

  it("lets a neighbor contact the poster", async () => {
    const fetch = serve(
      { path: "/lost-found/7", body: ITEM },
      { path: "/me", body: session(MEMBER) },
      {
        method: "POST",
        path: "/lost-found/7/contact",
        body: { message: "We've sent your message to Ben." },
      },
    );
    const user = userEvent.setup();
    const { container } = render(<LostItemDetail id="7" />);
    expect(await screen.findByRole("img", { name: "Photo of Brown dog" })).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
    await user.type(screen.getByLabelText(/I found this/), "Saw him by the park");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("status")).toHaveTextContent("We've sent your message to Ben.");
    expect(sent(fetch, "/lost-found/7/contact")?.[1].body).toBe(
      '{"message":"Saw him by the park"}',
    );
  });

  it("lets the poster close their post, and shows failures", async () => {
    serve(
      { path: "/lost-found/7", body: { ...ITEM, is_mine: true } },
      { path: "/me", body: session(MEMBER) },
      { method: "POST", path: "/lost-found/7/close", status: 500, body: { error: "Try later." } },
    );
    const user = userEvent.setup();
    render(<LostItemDetail id="7" />);
    await user.click(await screen.findByRole("button", { name: "Mark as reunited" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try later.");
    serve(
      { path: "/me", body: session(MEMBER) },
      {
        method: "POST",
        path: "/lost-found/7/close",
        body: { ...ITEM, is_mine: true, status: "closed" },
      },
    );
    await user.click(screen.getByRole("button", { name: "Mark as reunited" }));
    expect(await screen.findByText(/Thanks for closing the loop/)).toBeVisible();
    expect(screen.getByText("Reunited")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mark as reunited" })).toBeNull();
  });

  it("asks visitors to sign in to answer, and reports a missing post", async () => {
    serve(
      { path: "/lost-found/7", body: { ...ITEM, lat: null, lng: null } },
      { path: "/me", body: session(null) },
    );
    const { unmount } = render(<LostItemDetail id="7" />);
    expect(await screen.findByText(/to tell the owner you found it/)).toBeVisible();
    unmount();
    serve({ path: "/me", body: session(null) });
    render(<LostItemDetail id="7" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No route");
  });
});

describe("UpdatesList and NotificationsList", () => {
  it("shows announcements, marking urgent ones", async () => {
    serve({
      path: "/updates",
      body: [
        {
          id: 1,
          title: "Water main",
          body: "Closed",
          priority: "urgent",
          zip: null,
          author: "Sam",
          created_at: null,
        },
      ],
    });
    render(<UpdatesList />);
    expect(await screen.findByRole("heading", { name: "Water main" })).toBeVisible();
    expect(screen.getByText("Urgent")).toBeVisible();
    expect(screen.getByText(/Everyone · Sam/)).toBeVisible();
  });

  it("says when there are no updates", async () => {
    serve({ path: "/updates", body: [] });
    render(<UpdatesList />);
    expect(await screen.findByText("No updates right now.")).toBeVisible();
  });

  it("shows alerts with links into this app", async () => {
    serve({
      path: "/notifications",
      body: [
        {
          id: 1,
          kind: "lost",
          title: "Lost in your area",
          body: "A dog",
          link: "/lost-found/7",
          read: false,
          created_at: null,
        },
        {
          id: 2,
          kind: "info",
          title: "Test notification",
          body: null,
          link: null,
          read: true,
          created_at: null,
        },
      ],
    });
    render(<NotificationsList />);
    expect(await screen.findByRole("link", { name: "Lost in your area" })).toHaveAttribute(
      "href",
      "/lost-found/item?id=7",
    );
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("asks visitors to sign in for alerts", async () => {
    serve({ path: "/notifications", status: 401, body: { error: "Please sign in first." } });
    render(<NotificationsList />);
    expect(await screen.findByText(/to see your alerts/)).toBeVisible();
  });
});

describe("AccountPanel", () => {
  it("signs in, then shows settings", async () => {
    const fetch = serve(
      { path: "/me", body: session(null) },
      {
        method: "POST",
        path: "/login",
        status: 401,
        body: { error: "That email and password don't match." },
      },
    );
    const user = userEvent.setup();
    const { container } = render(<AccountPanel />);
    await user.type(await screen.findByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Password"), "longpass1");
    await user.click(within(screen.getByRole("form", { name: "Sign in" })).getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("don't match");
    expect(await axeViolations(container)).toEqual([]);

    serve(
      { path: "/me", body: session(MEMBER) },
      { method: "POST", path: "/login", body: { user: MEMBER } },
    );
    await user.click(within(screen.getByRole("form", { name: "Sign in" })).getByRole("button"));
    expect(await screen.findByText("Signed in as ana@example.com")).toBeVisible();
    expect(sent(fetch, "/login")?.[1].body).toBe(
      '{"email":"ana@example.com","password":"longpass1"}',
    );
  });

  it("creates an account with alert choices", async () => {
    const fetch = serve(
      { path: "/me", body: session(null) },
      { method: "POST", path: "/signup", status: 201, body: { user: MEMBER } },
    );
    const user = userEvent.setup();
    render(<AccountPanel />);
    await user.click(await screen.findByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("button", { name: "Create an account" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.type(screen.getByLabelText("Name"), "Ana");
    await user.type(screen.getByLabelText("ZIP code (for local alerts)"), "94110");
    expect(screen.getAllByText("(not set up on this server yet)")).toHaveLength(2);
    await user.click(screen.getByRole("checkbox", { name: /SMS text/ }));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    const body = JSON.parse(String(sent(fetch, "/signup")?.[1].body));
    expect(body).toMatchObject({ name: "Ana", zip: "94110", notify_email: true, notify_sms: true });
  });

  it("saves settings, connects Telegram, sends a test and signs out", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    serve(
      { path: "/me", body: session(MEMBER) },
      { method: "PUT", path: "/account", body: { user: { ...MEMBER, zip: "94103" } } },
      { method: "POST", path: "/account/telegram", body: { url: "https://t.me/bot?start=abc" } },
      { method: "POST", path: "/account/test", body: { message: "Test notification sent." } },
      { method: "POST", path: "/logout", body: { message: "Signed out." } },
    );
    const user = userEvent.setup();
    render(<AccountPanel />);
    const zip = await screen.findByLabelText("ZIP code");
    await user.clear(zip);
    await user.type(zip, "94103");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Your settings were saved.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Connect Telegram" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://t.me/bot?start=abc"));
    await user.click(screen.getByRole("button", { name: "Send a test alert" }));
    expect(await screen.findByText("Test notification sent.")).toBeVisible();
    serve(
      { path: "/me", body: session(null) },
      { method: "POST", path: "/logout", body: { message: "ok" } },
    );
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("form", { name: "Sign in" })).toBeVisible();
  });

  it("disconnects Telegram and shows a failed save", async () => {
    const linked = { ...MEMBER, telegram_connected: true, notify_telegram: true };
    serve(
      { path: "/me", body: session(linked) },
      { method: "POST", path: "/account/telegram", body: { user: MEMBER } },
      {
        method: "PUT",
        path: "/account",
        status: 400,
        body: { error: "Name and ZIP code are required." },
      },
    );
    const user = userEvent.setup();
    render(<AccountPanel />);
    expect(await screen.findByRole("checkbox", { name: "Telegram" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Disconnect Telegram" }));
    expect(await screen.findByRole("button", { name: "Connect Telegram" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Name and ZIP code are required.");
  });
});
