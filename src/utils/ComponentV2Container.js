const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    SectionBuilder
} = require("discord.js");

function ComponentV2Container(titleContent, textContent, options = {}) {
    const { thumbnailURL, mediaImageURL } = options;

    const title = new TextDisplayBuilder().setContent(titleContent);
    const text = new TextDisplayBuilder().setContent(textContent);
    const separator1 = new SeparatorBuilder().setDivider(true);
    const separator2 = new SeparatorBuilder().setDivider(true);
    const spacer = new TextDisplayBuilder().setContent('\u200B');

    const container = new ContainerBuilder()
        .addTextDisplayComponents(title)
        .addSeparatorComponents(separator1)
        .addTextDisplayComponents(spacer);

    if (thumbnailURL) {
        const section = new SectionBuilder()
            .addTextDisplayComponents(text)
            .setThumbnailAccessory({ media: { url: thumbnailURL } });
        container.addSectionComponents(section);
    } else {
        container.addTextDisplayComponents(text);
    }

    if (mediaImageURL?.trim()) {
        const mediaImage = new MediaGalleryBuilder().addItems([{ media: { url: mediaImageURL } }]);
        container.addSeparatorComponents(separator2).addMediaGalleryComponents(mediaImage);
    }

    return container;
}

module.exports = ComponentV2Container;