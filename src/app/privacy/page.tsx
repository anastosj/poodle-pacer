import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · Poodle Pacer",
  description: "What Poodle Pacer collects, why, and who it is shared with.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="pt-2 text-lg font-extrabold tracking-tight text-foreground">
    {children}
  </h2>
);

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="23 August 2026">
      <p>
        Poodle Pacer is a half marathon training tracker. This policy describes
        exactly what the app stores, why it stores it, and who else sees it.
      </p>

      <H>What we collect</H>
      <p>
        <strong>From Strava, when you sign in.</strong> Your Strava athlete ID,
        display name, and profile picture URL. We also store the access and
        refresh tokens Strava issues, so the app can read your activities later
        without asking you to sign in again. These tokens are kept on the server
        and are never sent to your browser.
      </p>
      <p>
        <strong>Your training data.</strong> The race you are training for, its
        date, and a record of each workout you complete: distance, duration,
        heart rate, elevation gain, cadence, the Strava activity name, and how
        the run felt.
      </p>
      <p>
        <strong>If you turn on text alerts.</strong> Your phone number, the time
        of day you want to hear from us, and your time zone.
      </p>
      <p>
        We do not ask for your date of birth, address, or payment details, and
        there is no advertising or analytics tracking in the app.
      </p>

      <H>What other people in the app can see</H>
      <p>
        This is the most important thing to understand before you sign up.
        Poodle Pacer has a shared page called The Pack, and{" "}
        <strong>
          every signed-in user can see every other signed-in user there
        </strong>
        . That page shows your name, your Strava profile picture, the race you
        are training for, your current week, and your training statistics:
        workouts completed, consistency, miles run, and average pace.
      </p>
      <p>
        Your phone number, your Strava tokens, and any notes are never shown to
        other users. Anyone who signs in can see The Pack, so treat your
        training statistics as visible to everyone using this app.
      </p>

      <H>Who we share data with</H>
      <p>
        We do not sell your information, and we do not share it with anyone for
        marketing or advertising. Data reaches only the services needed to run
        the app:
      </p>
      <ul className="ml-5 list-disc space-y-1.5">
        <li>
          <strong>Strava</strong>, to sign you in and read the activities you
          have authorised us to read.
        </li>
        <li>
          <strong>Twilio</strong>, to deliver text messages. Twilio receives
          your phone number and the message itself, and only when you have
          turned alerts on or asked for a confirmation text.
        </li>
        <li>
          <strong>Vercel</strong> (hosting) and <strong>Neon</strong>{" "}
          (database), which store the data on our behalf.
        </li>
      </ul>
      <p className="rounded-xl bg-poodle-cream px-4 py-3 text-sm">
        <strong>
          No mobile information is shared with third parties or affiliates for
          marketing or promotional purposes.
        </strong>{" "}
        Phone numbers are used only to send you the workout texts you asked for.
        Text message originator opt-in data and consent are never shared with
        any third party.
      </p>

      <H>Text messages</H>
      <p>
        Text alerts are off until you turn them on. You choose the time, and you
        can switch them off in Settings at any moment. You can also reply STOP
        to any message to stop them immediately, or HELP for assistance.
        Message and data rates may apply.
      </p>

      <H>How long we keep it</H>
      <p>
        Your training data stays until you delete it or ask us to remove your
        account. Disconnecting Strava in Settings deletes the stored Strava
        tokens straight away and signs you out.
      </p>

      <H>Your choices</H>
      <ul className="ml-5 list-disc space-y-1.5">
        <li>Turn text alerts off, or clear your number, in Settings.</li>
        <li>Reply STOP to any text to end messages from that number.</li>
        <li>
          Disconnect Strava in Settings, which removes the stored tokens.
        </li>
        <li>
          Revoke access entirely from your{" "}
          <a
            href="https://www.strava.com/settings/apps"
            className="font-semibold text-headband-dark underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Strava apps page
          </a>
          .
        </li>
        <li>
          Ask for your account and all its data to be deleted, using the contact
          below.
        </li>
      </ul>

      <H>Children</H>
      <p>
        Poodle Pacer is not intended for anyone under 13, and we do not
        knowingly collect information from children.
      </p>

      <H>Contact</H>
      <p>
        Questions, or a request to delete your data:{" "}
        <a
          href="mailto:jonathananastos@gmail.com"
          className="font-semibold text-headband-dark underline"
        >
          jonathananastos@gmail.com
        </a>
        .
      </p>
    </LegalPage>
  );
}
