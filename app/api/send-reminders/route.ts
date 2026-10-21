import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

function getTaiwanDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    webpush.setVapidDetails(
      "mailto:yuheyuan.calendar@gmail.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !vapidPublicKey ||
      !vapidPrivateKey
    ) {
      throw new Error("Missing required environment variables");
    }

    const now = new Date();

    // 為了涵蓋跨午夜的提醒，檢查今天與明天的預約
    const today = getTaiwanDateString(now);
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrow = getTaiwanDateString(tomorrowDate);

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(
        "id, user_id, title, start_date, start_time, reminder_minutes, reminder_sent_at"
      )
      .gte("start_date", today)
      .lte("start_date", tomorrow)
      .not("start_time", "is", null)
      .not("reminder_minutes", "is", null)
      .is("reminder_sent_at", null);

    if (eventsError) {
      throw eventsError;
    }

    let sentCount = 0;

    for (const event of events ?? []) {
      if (!event.start_time || event.reminder_minutes == null) continue;

      // 行事曆時間以台灣時間計算
      const eventTime = new Date(
        `${event.start_date}T${event.start_time}+08:00`
      );

      const reminderTime = new Date(
        eventTime.getTime() - event.reminder_minutes * 60 * 1000
      );

      // 尚未到提醒時間
      if (now < reminderTime) continue;

      // 預約時間已經過了，就不補發舊通知
      if (now >= eventTime) continue;

      const { data: subscriptions, error: subscriptionError } =
        await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", event.user_id);

      if (subscriptionError) {
        console.error(
          `Unable to load subscriptions for event ${event.id}:`,
          subscriptionError
        );
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        continue;
      }

      let eventSent = false;

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              title: "宇和苑行事曆",
              body: `${event.start_time.slice(0, 5)} ${event.title}，預約即將開始`,
              url: "/",
            })
          );

          eventSent = true;
        } catch (pushError) {
          console.error(
            `Push notification failed for event ${event.id}:`,
            pushError
          );
        }
      }

      // 至少有一台裝置成功收到後，才標記為已發送
      if (eventSent) {
        const { error: updateError } = await supabase
          .from("events")
          .update({
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", event.id)
          .is("reminder_sent_at", null);

        if (!updateError) {
          sentCount += 1;
        } else {
          console.error(
            `Unable to mark event ${event.id} as sent:`,
            updateError
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: events?.length ?? 0,
      sent: sentCount,
    });
  } catch (error) {
    console.error("send-reminders error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}