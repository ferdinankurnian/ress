"use no memo";
import React from "react";
import {
  FlexWidget,
  ImageWidget,
  TextWidget,
  type ImageWidgetSource,
} from "react-native-android-widget";
import { Article, relativeTime } from "../data/feeds";
import { theme, colorsFor } from "../ui/theme";
export function RessWidget({
  articles,
  height = 260,
  synced,
  failed = false,
  scheme = "light",
}: {
  articles: Article[];
  height?: number;
  synced: string;
  failed?: boolean;
  scheme?: "light" | "dark";
}) {
  "use no memo";
  const c = colorsFor(scheme);
  const count = Math.max(1, Math.min(4, Math.floor((height - 80) / 92)));
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: scheme === "dark" ? c.paper : c.yellowSoft,
        borderRadius: 24,
        padding: 16,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: "row",
          width: "match_parent",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <TextWidget
          text="ress"
          style={{
            fontSize: 30,
            fontFamily: theme.font.widgetDisplay,
            fontWeight: "bold",
            color: c.ink,
          }}
          clickAction="OPEN_APP"
        />
        <TextWidget
          text="Refresh"
          style={{
            fontSize: 12,
            color: c.accentInk,
            backgroundColor: c.yellow,
            borderRadius: 16,
            padding: 10,
          }}
          clickAction="REFRESH"
        />
      </FlexWidget>
      {articles.length ? (
        articles.slice(0, count).map((a) => (
          <FlexWidget
            key={a.id}
            style={{ width: "match_parent", paddingVertical: 8 }}
            clickAction="OPEN_URI"
            clickActionData={{
              uri: `ress://article?id=${encodeURIComponent(a.id)}`,
            }}
          >
            <FlexWidget
              style={{
                flexDirection: "row",
                alignItems: "center",
                width: "match_parent",
              }}
            >
              <FlexWidget style={{ flex: 1 }}>
                <FlexWidget
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 5,
                  }}
                >
                  {a.favicon ? (
                    <ImageWidget
                      image={a.favicon as ImageWidgetSource}
                      imageWidth={16}
                      imageHeight={16}
                      radius={8}
                      style={{ marginRight: 6 }}
                    />
                  ) : null}
                  <TextWidget
                    text={a.source}
                    maxLines={1}
                    truncate="END"
                    style={{
                      color: c.muted,
                      fontSize: 11,
                      fontFamily: theme.font.widget,
                    }}
                  />
                </FlexWidget>
                <TextWidget
                  text={a.title}
                  maxLines={2}
                  truncate="END"
                  style={{
                    color: c.ink,
                    fontSize: 16,
                    fontFamily: theme.font.widgetDisplay,
                  }}
                />
                <TextWidget
                  text={relativeTime(a.date)}
                  maxLines={1}
                  style={{ color: c.muted, fontSize: 10, marginTop: 4 }}
                />
              </FlexWidget>
              {a.image ? (
                <ImageWidget
                  image={a.image as ImageWidgetSource}
                  imageWidth={64}
                  imageHeight={64}
                  radius={8}
                  resizeMode="cover"
                  style={{ marginLeft: 10 }}
                />
              ) : null}
            </FlexWidget>
          </FlexWidget>
        ))
      ) : (
        <TextWidget
          text="No articles here yet. Open Ress to add or refresh your sources."
          style={{ color: c.ink, fontSize: 16, paddingVertical: 12 }}
          clickAction="OPEN_APP"
        />
      )}
      <TextWidget
        text={
          failed
            ? "Offline — showing saved edition"
            : synced
              ? `Updated ${relativeTime(synced)}`
              : "Open Ress to add a source"
        }
        maxLines={1}
        style={{ color: c.muted, fontSize: 11, marginTop: 4 }}
        clickAction="OPEN_APP"
      />
    </FlexWidget>
  );
}
