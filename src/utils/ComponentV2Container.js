const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    SectionBuilder
} = require("discord.js");

function ComponentV2Container(titleContent, textContent, options = {}) {
    const { thumbnailURL, mediaImageURL, columns } = options;

    const title = new TextDisplayBuilder().setContent(titleContent);
    const text = new TextDisplayBuilder().setContent(textContent);
    const separator1 = new SeparatorBuilder().setDivider(true);
    const separator2 = new SeparatorBuilder().setDivider(true);

    const container = new ContainerBuilder()
        .addTextDisplayComponents(title)
        .addSeparatorComponents(separator1);

    if (columns && Array.isArray(columns) && columns.length > 0) {
        const longestLineCount = Math.max(...columns.map(col => col.split('\n').reduce((max, line) => Math.max(max, line.length), 0)));
        const paddedColumns = columns.map(col => {
            const lines = col.split('\n');
            return lines.map(line => line.padEnd(longestLineCount + 4, ' '));
        });

        let columnarText = '';
        const maxLines = Math.max(...paddedColumns.map(col => col.length));

        for (let i = 0; i < maxLines; i++) {
            let row = '';
            for (let j = 0; j < paddedColumns.length; j++) {
                row += paddedColumns[j][i] || ' '.repeat(longestLineCount + 4);
                if (j < paddedColumns.length - 1) {
                    row += '┃ ';
                }
            }
            columnarText += row + '\n';
        }

        text.setContent(`${textContent}\n\n${columnarText.trimEnd()}`);
    }

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