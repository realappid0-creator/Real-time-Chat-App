self.addEventListener("push", (event) => {
  if (!event.data) return;

  const message = event.data.json();
  const title = typeof message.title === "string" ? message.title : "New message";
  const options = {
    body: typeof message.body === "string" ? message.body : "You have a new message",
    icon: new URL("logo.svg", self.registration.scope).href,
    data: { url: typeof message.url === "string" ? message.url : "./" },
  };

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const visibleClients = clients.filter(
        (client) => client.visibilityState === "visible",
      );

      if (visibleClients.length > 0) {
        for (const client of visibleClients) {
          client.postMessage({
            type: "NEXCHAT_PUSH_MESSAGE",
            title,
            body: options.body,
          });
        }
        return;
      }

      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(
    event.notification.data?.url ?? "./",
    self.registration.scope,
  ).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(destination);
          return;
        }
      }
      await self.clients.openWindow(destination);
    })(),
  );
});
