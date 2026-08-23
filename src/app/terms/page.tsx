import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service · Poodle Pacer",
  description:
    "Terms for using Poodle Pacer, including the morning workout text programme.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="pt-2 text-lg font-extrabold tracking-tight text-foreground">
    {children}
  </h2>
);

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="23 August 2026">
      <p>
        Poodle Pacer is a personal half marathon training tracker. By signing in
        you agree to these terms.
      </p>

      <H>The service</H>
      <p>
        The app follows a published Hal Higdon training programme, records the
        workouts you complete, can import runs from Strava, and shows how you
        are progressing. It is provided free and as is, with no guarantee that
        it will be available or error free.
      </p>

      <H>Your account</H>
      <p>
        You sign in with Strava, so your Strava account governs access. Keep it
        secure. You are responsible for what happens under your account, and you
        may stop using the app at any time by disconnecting Strava in Settings.
      </p>

      <H>What other users see</H>
      <p>
        The Pack shows your name, profile picture, race, and training statistics
        to every other signed-in user. Do not use the app if you would rather
        that information stayed private. See the{" "}
        <a href="/privacy" className="font-semibold text-headband-dark underline">
          Privacy Policy
        </a>{" "}
        for detail.
      </p>

      <H>Morning workout texts</H>
      <p>
        This is an optional text message programme for people training with the
        app.
      </p>
      <ul className="ml-5 list-disc space-y-1.5">
        <li>
          <strong>How you opt in.</strong> You enter your own phone number in
          Settings and press a button to send yourself a confirmation text.
          Alerts stay off until you switch them on.
        </li>
        <li>
          <strong>What you receive.</strong> A message on mornings when a
          workout is scheduled, telling you what that workout is. Rest days are
          quiet. The day before your race you receive encouragement, and on race
          morning a good luck message.
        </li>
        <li>
          <strong>How often.</strong> Up to one message per day. In a typical
          training week that is four or five.
        </li>
        <li>
          <strong>How to stop.</strong> Reply STOP to any message and they end
          immediately. You can also switch alerts off, or clear your number, in
          Settings. Reply HELP for assistance.
        </li>
        <li>
          <strong>Cost.</strong> The app charges nothing. Message and data rates
          may apply from your mobile carrier.
        </li>
        <li>
          <strong>Delivery.</strong> Carriers do not guarantee delivery, and
          messages can be delayed or dropped. We are not liable for a message
          that does not arrive.
        </li>
      </ul>
      <p>
        Only enter a phone number you control. Do not sign someone else up.
      </p>

      <H>Training advice</H>
      <p>
        Poodle Pacer is not medical advice and is not a substitute for a coach
        or a doctor. Training for a half marathon carries a risk of injury. Talk
        to a qualified professional before starting, listen to your body, and
        stop if something hurts. You train at your own risk.
      </p>

      <H>Strava</H>
      <p>
        Importing runs requires you to authorise the app on Strava, and your use
        of Strava remains subject to Strava&apos;s own terms. You can revoke
        access at any time from your Strava settings.
      </p>

      <H>Acceptable use</H>
      <p>
        Do not attempt to access other people&apos;s accounts, disrupt the
        service, or use it to send unwanted messages. We may remove an account
        that does.
      </p>

      <H>Changes</H>
      <p>
        These terms may change. Continuing to use the app after a change means
        you accept the updated version, and the date at the top will tell you
        when it last changed.
      </p>

      <H>Contact</H>
      <p>
        <a
          href="mailto:jonathananastos@gmail.com"
          className="font-semibold text-headband-dark underline"
        >
          jonathananastos@gmail.com
        </a>
      </p>
    </LegalPage>
  );
}
