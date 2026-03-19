const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    ThumbnailBuilder,
    SectionBuilder
} = require("discord.js");

function ComponentV2Container(titleContent, textContent, mediaImageURL) {
    const title = new TextDisplayBuilder().setContent(titleContent);
    const text = new TextDisplayBuilder().setContent(textContent);

    const separator1 = new SeparatorBuilder().setDivider(true);
    const separator2 = new SeparatorBuilder().setDivider(true);

    const spacer = new TextDisplayBuilder().setContent('\u200B');

    const container = new ContainerBuilder()
        .addTextDisplayComponents(title)
        .addSeparatorComponents(separator1)
        .addTextDisplayComponents(spacer)
        .addTextDisplayComponents(text);

    if (mediaImageURL && mediaImageURL.trim() !== "") {
        const mediaImage = new MediaGalleryBuilder()
            .addItems([
                {
                    media: {
                        url: mediaImageURL,
                    }
                }
            ]);

        container.addSeparatorComponents(separator2);
        container.addMediaGalleryComponents(mediaImage);
    }

    return container;
}

module.exports = ComponentV2Container;