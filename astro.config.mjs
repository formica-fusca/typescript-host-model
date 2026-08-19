// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Deployed as a GitHub *project* page, so the site is served from a
// sub-path rather than the domain root. `site` + `base` together are what make
// canonical URLs, the sitemap and every Starlight-generated link resolve
// correctly under /typescript-host-model/.
//
// Consequence worth knowing: Astro does NOT rewrite absolute links written by
// hand inside markdown. Content in src/content/docs therefore uses *relative*
// links between pages, which are base-agnostic and survive the site moving.
export default defineConfig({
  site: "https://formica-fusca.github.io",
  base: "/typescript-host-model",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Describing the host",
      description:
        "The four TypeScript compiler options that describe a runtime — target, lib, module and moduleResolution — and what happens when the description is wrong.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/formica-fusca/typescript-host-model",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/formica-fusca/typescript-host-model/edit/main/",
      },
      lastUpdated: true,
      sidebar: [
        {
          label: "Start here",
          items: [
            { slug: "start-here" },
            { slug: "syllabus" },
          ],
        },
        {
          label: "The exercise",
          items: [{ autogenerate: { directory: "case-study" } }],
        },
        {
          label: "Units",
          items: [{ autogenerate: { directory: "units" } }],
        },
      ],
      customCss: ["./src/styles/course.css"],
    }),
  ],
});
