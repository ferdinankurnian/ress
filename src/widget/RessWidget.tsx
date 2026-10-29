"use no memo";
import React from "react";
import {
  FlexWidget,
  ListWidget,
  ImageWidget,
  SvgWidget,
  TextWidget,
  type ImageWidgetSource,
} from "react-native-android-widget";
import { Article, relativeTime } from "../data/feeds";
import type { ThumbnailLayout } from "../ui/articleImages";
import { theme, colorsFor, type BackgroundPreference } from "../ui/theme";
export function RessWidget({
  articles,
  width = 300,
  synced,
  failed = false,
  refreshing = false,
  scheme = "light",
  background = "warm",
}: {
  articles: (Article & { thumbnailLayout?: ThumbnailLayout })[];
  width?: number;
  height?: number;
  synced: string;
  failed?: boolean;
  refreshing?: boolean;
  scheme?: "light" | "dark";
  background?: BackgroundPreference;
}) {
  "use no memo";
  const c = colorsFor(scheme, background);
  const contentWidth = Math.max(0, width - 32);
  // Keep the title legible and reserve the full refresh hit area at every width.
  const statusWidth = Math.max(0, Math.min(96, contentWidth - 120));
  const thumbnailWidth = contentWidth;
  const visibleArticles = articles.slice(0, 10);
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: background === "plain" || scheme === "dark" ? c.paper : c.yellowSoft,
        borderRadius: 24,
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          height: 48,
          paddingLeft: 16,
          paddingTop: 4,
          paddingRight: 4,
          paddingBottom: 4,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <TextWidget
            text="ress"
            style={{
              fontSize: 30,
              fontFamily: "Vollkorn_600SemiBold",
              color: c.ink,
            }}
            clickAction="OPEN_APP"
          />
        </FlexWidget>
        <TextWidget
          text={
            refreshing ? "Refreshing…" : failed ? "Offline" : synced ? `Updated ${relativeTime(synced)}` : ""
          }
          style={{
            width: statusWidth,
            color: c.muted,
            fontFamily: theme.font.body,
            fontSize: 10,
            marginRight: statusWidth ? 8 : 0,
            textAlign: "right",
          }}
          maxLines={1}
          truncate="END"
        />
        <FlexWidget
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="REFRESH"
          accessibilityLabel="Refresh feeds"
        >
          <SvgWidget
            svg={`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c.ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`}
            style={{ width: 22, height: 22 }}
          />
        </FlexWidget>
      </FlexWidget>
      {articles.length ? (
        <FlexWidget style={{ width: "match_parent", height: 0, flex: 1 }}>
          <ListWidget style={{ width: "match_parent", height: "match_parent" }}>
            {visibleArticles.map((a, index) => {
              const square = a.thumbnailLayout === "square";
              const image = a.image && a.thumbnailLayout !== "hidden" ? (
                <ImageWidget image={a.image as ImageWidgetSource}
                  imageWidth={square ? 72 : thumbnailWidth}
                  imageHeight={square ? 72 : Math.round(thumbnailWidth * 9 / 16)}
                  radius={8} resizeMode="cover"
                  style={square ? { marginLeft: 12 } : { marginBottom: 10 }} />
              ) : null;
              return (
                <FlexWidget
                  key={a.id}
                  style={{
                    width: "match_parent",
                    flexDirection: square ? "row" : "column",
                    alignItems: "flex-start",
                    // Insets belong to scrollable rows, not the viewport.
                    marginHorizontal: 16,
                    paddingVertical: 16,
                    borderBottomWidth: index === visibleArticles.length - 1 ? 0 : 1,
                    borderBottomColor: background === "plain" ? c.rule : scheme === "dark" ? "#3A3D31" : "#DDD39B",
                  }}
                  clickAction="OPEN_URI"
                  clickActionData={{
                    uri: `ress://article?id=${encodeURIComponent(a.id)}`,
                  }}
                >
                  {!square && image}
                  <FlexWidget style={square ? { width: 0, flex: 1 } : { width: "match_parent" }}>
                  <FlexWidget
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
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
                        fontFamily: theme.font.body,
                      }}
                    />
                  </FlexWidget>
                      <TextWidget
                        text={a.title}
                        maxLines={3}
                        truncate="END"
                        style={{
                          color: c.ink,
                          fontSize: 17,
                          fontFamily: theme.font.bold,
                        }}
                      />
                      <TextWidget
                        text={relativeTime(a.date)}
                        style={{ color: c.muted, fontFamily: theme.font.body, fontSize: 10, marginTop: 7 }}
                      />
                  </FlexWidget>
                  {square && image}
                </FlexWidget>
              );
            })}
          </ListWidget>
        </FlexWidget>
      ) : (
        <TextWidget
          text="No articles here yet. Open Ress to add or refresh your sources."
          style={{ color: c.ink, fontSize: 16, padding: 16 }}
          clickAction="OPEN_APP"
        />
      )}
    </FlexWidget>
  );
}
