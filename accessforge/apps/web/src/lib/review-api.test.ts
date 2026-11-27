import { afterEach, expect, it, vi } from "vitest";
import {
  SESSION_ENDED,
  fetchReviews,
  fetchSession,
  signIn,
  signOut,
  submitReview,
} from "./review-api";

const signal = () => new AbortController().signal;
function stub(response: Response | Error) {
  const mock =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}
afterEach(() => vi.unstubAllGlobals());

it("treats anything but a reviewer ID as a signed-out visitor", async () => {
  stub(new Response(JSON.stringify({ data: { reviewer_id: "abc" } })));
  await expect(fetchSession(signal())).resolves.toBe("abc");
  stub(new Response(JSON.stringify({ data: { id: "a report, not a session" } })));
  await expect(fetchSession(signal())).resolves.toBeNull();
  stub(new Response("", { status: 401 }));
  await expect(fetchSession(signal())).resolves.toBeNull();
  stub(new TypeError("offline"));
  await expect(fetchSession(signal())).resolves.toBeNull();
});

it("sends the key only in the sign-in body and maps failures to plain messages", async () => {
  const mock = stub(new Response(JSON.stringify({ data: { reviewer_id: "abc" } })));
  await expect(signIn("secret")).resolves.toBe("abc");
  expect(mock.mock.calls[0][0]).toBe("/api/reviewer/session");
  expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ key: "secret" });

  stub(new Response("", { status: 429 }));
  await expect(signIn("x")).rejects.toThrow("Too many failed sign-in attempts");
  stub(new Response("", { status: 500 }));
  await expect(signOut()).rejects.toThrow("could not complete this request");
  stub(new TypeError("offline"));
  await expect(submitReview("id", "verified", "ok")).rejects.toThrow("Cannot reach");
  stub(new Response("", { status: 401 }));
  await expect(fetchReviews("id", signal())).rejects.toThrow(SESSION_ENDED);
});

it("passes through a caller's abort", async () => {
  stub(new TypeError("aborted"));
  const controller = new AbortController();
  controller.abort();
  await expect(fetchReviews("id", controller.signal)).rejects.toThrow("aborted");
  await expect(fetchSession(controller.signal)).rejects.toThrow("aborted");
});
