
const { createCanvas, loadImage } = require('canvas');
const {
  getBadgeImagePath,
  badgeImageExists
} = require('./fileHandler');

class BadgeCanvasGenerator {
  constructor() {
    this.catalogBadgesPerPage = 6;
    this.memberBadgesPerPage = 6;
    this.badgesPerPage = 6;

    this.colors = {
  cream: '#030104',
  paper: '#09050A',
  white: '#120712',

  pink: '#FF1493',
  softPink: '#3A0B28',

  berry: '#FF3CAC',
  darkBerry: '#FFD2ED',

  text: '#FFF8FD',
  muted: '#D0AABE',

  line: '#B60068'
};
  }

  async loadBadgeImage(badge) {
    if (!badgeImageExists(badge.imagePath)) {
      throw new Error(`Image not found for ${badge.name}`);
    }

    const imagePath = getBadgeImagePath(badge.imagePath);
    return loadImage(imagePath);
  }

  drawContainedImage(
    ctx,
    image,
    x,
    y,
    maxWidth,
    maxHeight
  ) {
    const scale = Math.min(
      maxWidth / image.width,
      maxHeight / image.height
    );

    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    ctx.drawImage(
      image,
      x + (maxWidth - drawWidth) / 2,
      y + (maxHeight - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
  }

  async generateCatalogPage(
    badges,
    pageNumber,
    totalPages,
    categoryName = null
  ) {
    const canvasWidth = 900;
    const columns = 2;
    const rows = Math.max(
      1,
      Math.ceil(badges.length / columns)
    );

    const headerHeight = 138;
    const recordHeight = 170;
    const columnGap = 20;
    const rowGap = 20;
    const sideMargin = 36;
    const footerHeight = 52;

    const recordWidth =
      (canvasWidth -
        sideMargin * 2 -
        columnGap) /
      columns;

    const canvasHeight =
      headerHeight +
      rows * recordHeight +
      Math.max(0, rows - 1) * rowGap +
      footerHeight;

    const canvas = createCanvas(
      canvasWidth,
      canvasHeight
    );

    const ctx = canvas.getContext('2d');

    // Main background
    ctx.fillStyle = this.colors.cream;
    ctx.fillRect(
      0,
      0,
      canvasWidth,
      canvasHeight
    );

    // Outer catalog border
    ctx.strokeStyle = this.colors.berry;
    ctx.lineWidth = 4;

    this.roundRect(
      ctx,
      18,
      18,
      canvasWidth - 36,
      canvasHeight - 36,
      22
    );

    ctx.stroke();

    // Catalog header
    ctx.fillStyle = this.colors.softPink;

    this.roundRect(
      ctx,
      36,
      36,
      canvasWidth - 72,
      82,
      18
    );

    ctx.fill();

    ctx.fillStyle = this.colors.darkBerry;
    ctx.font = 'bold 31px Arial, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(
      categoryName
        ? `${categoryName} Badge Catalog`
        : 'TBB Badge Catalog',
      canvasWidth / 2,
      72
    );

    ctx.fillStyle = this.colors.muted;
    ctx.font = '15px Arial, sans-serif';

    ctx.fillText(
      'The Baddies Bookshelf • Official Badge Records',
      canvasWidth / 2,
      99
    );

    for (let i = 0; i < badges.length; i++) {
      const badge = badges[i];

      const row = Math.floor(i / columns);
      const column = i % columns;

      const recordX =
        sideMargin +
        column * (recordWidth + columnGap);

      const recordY =
        headerHeight +
        row * (recordHeight + rowGap);

      // Record shadow
      ctx.save();

      ctx.shadowColor =
        'rgba(116, 54, 79, 0.12)';

      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = this.colors.paper;

      this.roundRect(
        ctx,
        recordX,
        recordY,
        recordWidth,
        recordHeight,
        16
      );

      ctx.fill();
      ctx.restore();

      // Record outline
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 2;

      this.roundRect(
        ctx,
        recordX,
        recordY,
        recordWidth,
        recordHeight,
        16
      );

      ctx.stroke();

      // Badge image area
      const stampSize = 118;
      const stampX = recordX + 16;
      const stampY = recordY + 18;

      ctx.fillStyle = this.colors.softPink;

      this.roundRect(
        ctx,
        stampX,
        stampY,
        stampSize,
        stampSize,
        16
      );

      ctx.fill();

      try {
        const image =
          await this.loadBadgeImage(badge);

        this.drawContainedImage(
          ctx,
          image,
          stampX + 10,
          stampY + 10,
          stampSize - 20,
          stampSize - 20
        );
      } catch (error) {
        console.error(error);

        ctx.fillStyle = this.colors.berry;
        ctx.font = '48px Arial, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillText(
          '🎖️',
          stampX + stampSize / 2,
          stampY + 77
        );
      }

      const textX =
        stampX + stampSize + 18;

      const availableWidth =
        recordWidth - stampSize - 52;

      ctx.textAlign = 'left';

      // Badge name
      ctx.fillStyle = this.colors.darkBerry;
      ctx.font = 'bold 20px Arial, sans-serif';

      ctx.fillText(
        this.truncateText(
          ctx,
          badge.name,
          availableWidth
        ),
        textX,
        recordY + 42
      );

      // Category
      ctx.fillStyle = this.colors.pink;
      ctx.font = 'bold 13px Arial, sans-serif';

      ctx.fillText(
        this.truncateText(
          ctx,
          `CATEGORY: ${
            badge.category || 'Uncategorized'
          }`,
          availableWidth
        ),
        textX,
        recordY + 68
      );

      // Divider
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(
        textX,
        recordY + 80
      );

      ctx.lineTo(
        recordX + recordWidth - 18,
        recordY + 80
      );

      ctx.stroke();

      // Description
      ctx.fillStyle = this.colors.text;
      ctx.font = '15px Arial, sans-serif';

      this.drawWrappedText(
        ctx,
        badge.description ||
          'No description provided.',
        textX,
        recordY + 106,
        availableWidth,
        21,
        2
      );
    }

    // Catalog footer
    ctx.fillStyle = this.colors.muted;
    ctx.font = '13px Arial, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(
      `Catalog Page ${pageNumber} of ${totalPages}`,
      canvasWidth / 2,
      canvasHeight - 25
    );

    return canvas.toBuffer('image/png');
  }

  async generateMemberCardPage(
  badges,
  pageNumber,
  totalPages,
  memberName,
  totalBadgeCount,
  baddieSince = 'Unknown'
) {
  const canvasWidth = 900;
  const badgesPerRow = 3;

  const rows = Math.max(
    1,
    Math.ceil(badges.length / badgesPerRow)
  );

  const headerHeight = 186;
  const badgeCardHeight = 182;
  const rowGap = 16;
  const footerHeight = 68;

  const canvasHeight =
    headerHeight +
    rows * badgeCardHeight +
    Math.max(0, rows - 1) * rowGap +
    footerHeight;

  const canvas = createCanvas(
    canvasWidth,
    canvasHeight
  );

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = this.colors.cream;
  ctx.fillRect(
    0,
    0,
    canvasWidth,
    canvasHeight
  );

  ctx.fillStyle = this.colors.paper;

  this.roundRect(
    ctx,
    22,
    22,
    canvasWidth - 44,
    canvasHeight - 44,
    24
  );

  ctx.fill();

  ctx.strokeStyle = this.colors.berry;
  ctx.lineWidth = 4;

  this.roundRect(
    ctx,
    22,
    22,
    canvasWidth - 44,
    canvasHeight - 44,
    24
  );

  ctx.stroke();

  ctx.fillStyle = this.colors.softPink;

  this.roundRect(
    ctx,
    42,
    42,
    canvasWidth - 84,
    118,
    18
  );

  ctx.fill();

  ctx.fillStyle = this.colors.darkBerry;
  ctx.font = 'bold 29px Arial, sans-serif';
  ctx.textAlign = 'center';

  ctx.fillText(
    'THE BADDIES BOOKSHELF',
    canvasWidth / 2,
    78
  );

  ctx.fillStyle = this.colors.berry;
  ctx.font = 'bold 19px Arial, sans-serif';

  ctx.fillText(
    'BADDIE LIBRARY CARD',
    canvasWidth / 2,
    106
  );

  ctx.fillStyle = this.colors.text;
  ctx.font = '16px Arial, sans-serif';

  ctx.fillText(
    `Cardholder: ${memberName}  •  Baddie Since: ${baddieSince}  •  Badges Earned: ${totalBadgeCount}`,
    canvasWidth / 2,
    139
  );

  const badgeCardWidth = 188;
  const gap = 12;
  const startY = headerHeight;

  for (let row = 0; row < rows; row++) {
    const firstBadgeIndex = row * badgesPerRow;
    const badgesRemaining = badges.length - firstBadgeIndex;

    const badgesInThisRow = Math.min(
      badgesPerRow,
      badgesRemaining
    );

    const rowWidth =
      badgesInThisRow * badgeCardWidth +
      Math.max(0, badgesInThisRow - 1) * gap;

    const rowStartX =
      (canvasWidth - rowWidth) / 2;

    for (
      let column = 0;
      column < badgesInThisRow;
      column++
    ) {
      const badgeIndex =
        firstBadgeIndex + column;

      const badge = badges[badgeIndex];

      const cardX =
        rowStartX +
        column * (badgeCardWidth + gap);

      const cardY =
        startY +
        row * (badgeCardHeight + rowGap);

      const centerX =
        cardX + badgeCardWidth / 2;

      ctx.save();

      ctx.shadowColor = 'rgba(255, 20, 147, 0.30)';

      ctx.shadowBlur = 7;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = this.colors.white;

      this.roundRect(
        ctx,
        cardX,
        cardY,
        badgeCardWidth,
        badgeCardHeight,
        16
      );

      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 2;

      this.roundRect(
        ctx,
        cardX,
        cardY,
        badgeCardWidth,
        badgeCardHeight,
        16
      );

      ctx.stroke();

      const stampWidth = 122;
      const stampHeight = 106;

      const stampX =
        centerX - stampWidth / 2;

      const stampY = cardY + 12;

      ctx.fillStyle = this.colors.softPink;

      this.roundRect(
        ctx,
        stampX,
        stampY,
        stampWidth,
        stampHeight,
        14
      );

      ctx.fill();

      try {
        const image =
          await this.loadBadgeImage(badge);

        this.drawContainedImage(
          ctx,
          image,
          stampX + 9,
          stampY + 9,
          stampWidth - 18,
          stampHeight - 18
        );
      } catch (error) {
        console.error(error);

        ctx.fillStyle = this.colors.berry;
        ctx.font = '43px Arial, sans-serif';
        ctx.textAlign = 'center';

        ctx.fillText(
          '🎖️',
          centerX,
          stampY + 69
        );
      }

      ctx.fillStyle =
        this.colors.darkBerry;

      ctx.font =
        'bold 16px Arial, sans-serif';

      ctx.textAlign = 'center';

      ctx.fillText(
        this.truncateText(
          ctx,
          badge.name,
          badgeCardWidth - 20
        ),
        centerX,
        cardY + 145
      );

      ctx.fillStyle = this.colors.pink;
      ctx.font = '12px Arial, sans-serif';

      ctx.fillText(
        this.truncateText(
          ctx,
          badge.category || 'Uncategorized',
          badgeCardWidth - 24
        ),
        centerX,
        cardY + 166
      );
    }
  }

  ctx.fillStyle = this.colors.muted;
  ctx.font = '14px Arial, sans-serif';
  ctx.textAlign = 'center';

  ctx.fillText(
    `Library Card Page ${pageNumber} of ${totalPages}`,
    canvasWidth / 2,
    canvasHeight - 38
  );

  return canvas.toBuffer('image/png');
}

async generateLeaderboardCard(
  leaderboard,
  userRank,
  userBadgeCount,
  memberName
) {
  const canvasWidth = 900;
  const rowHeight = 58;
  const headerHeight = 180;
  const footerHeight = 120;

  const canvasHeight =
    headerHeight +
    leaderboard.length * rowHeight +
    footerHeight;

  const canvas = createCanvas(
    canvasWidth,
    canvasHeight
  );

  const ctx = canvas.getContext('2d');

  // Outer background
  ctx.fillStyle = this.colors.cream;
  ctx.fillRect(
    0,
    0,
    canvasWidth,
    canvasHeight
  );

  // Main card
  ctx.fillStyle = this.colors.paper;

  this.roundRect(
    ctx,
    22,
    22,
    canvasWidth - 44,
    canvasHeight - 44,
    24
  );

  ctx.fill();

  // Neon outer border
  ctx.save();

  ctx.shadowColor =
    'rgba(255, 20, 147, 0.45)';
  ctx.shadowBlur = 12;

  ctx.strokeStyle = this.colors.pink;
  ctx.lineWidth = 4;

  this.roundRect(
    ctx,
    22,
    22,
    canvasWidth - 44,
    canvasHeight - 44,
    24
  );

  ctx.stroke();

  ctx.restore();

  // Header
  ctx.fillStyle = this.colors.white;

  this.roundRect(
    ctx,
    42,
    42,
    canvasWidth - 84,
    108,
    18
  );

  ctx.fill();

  ctx.textAlign = 'center';

  ctx.fillStyle = this.colors.darkBerry;
  ctx.font = 'bold 30px Arial, sans-serif';

  ctx.fillText(
    'THE BADDIES BOOKSHELF',
    canvasWidth / 2,
    77
  );

  ctx.fillStyle = this.colors.pink;
  ctx.font = 'bold 22px Arial, sans-serif';

  ctx.fillText(
    "THE ARCHIVIST'S LEDGER",
    canvasWidth / 2,
    108
  );

  ctx.fillStyle = this.colors.muted;
  ctx.font = '15px Arial, sans-serif';

  ctx.fillText(
    'Current Badge Rankings',
    canvasWidth / 2,
    132
  );

  // Column headings
  const startY = 185;

  ctx.textAlign = 'left';
  ctx.fillStyle = this.colors.pink;
  ctx.font = 'bold 15px Arial, sans-serif';

  ctx.fillText(
    'RANK',
    75,
    startY
  );

  ctx.fillText(
    'MEMBER',
    165,
    startY
  );

  ctx.textAlign = 'right';

  ctx.fillText(
    'BADGES',
    825,
    startY
  );

  // Header divider
  ctx.strokeStyle = this.colors.line;
  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.moveTo(
    55,
    startY + 14
  );

  ctx.lineTo(
    845,
    startY + 14
  );

  ctx.stroke();

  let currentY = startY + 42;

  for (const entry of leaderboard) {
    const rowColor = this.colors.white;

    ctx.save();

    ctx.shadowColor =
      'rgba(255, 20, 147, 0.22)';

    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = rowColor;

    this.roundRect(
      ctx,
      50,
      currentY - 30,
      800,
      42,
      12
    );

    ctx.fill();

    ctx.restore();

    // Row outline
    ctx.strokeStyle = this.colors.line;
    ctx.lineWidth = 1.5;

    this.roundRect(
      ctx,
      50,
      currentY - 30,
      800,
      42,
      12
    );

    ctx.stroke();

    // Rank circle
    let rankColor = this.colors.pink;

    if (entry.rank === 1) {
      rankColor = '#E8B33A';
    }

    if (entry.rank === 2) {
      rankColor = '#BFC5CF';
    }

    if (entry.rank === 3) {
      rankColor = '#CC8A5F';
    }

    ctx.beginPath();

    ctx.fillStyle = rankColor;

    ctx.arc(
      88,
      currentY - 10,
      15,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // Rank number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(
      String(entry.rank),
      88,
      currentY - 5
    );

    // Member name
    ctx.textAlign = 'left';

    ctx.fillStyle = this.colors.darkBerry;
    ctx.font = 'bold 17px Arial, sans-serif';

    ctx.fillText(
      this.truncateText(
        ctx,
        entry.username,
        420
      ),
      130,
      currentY - 4
    );

    // Badge count pill
    const badgeText =
      String(entry.badgeCount);

    ctx.font = 'bold 15px Arial, sans-serif';

    const pillWidth = Math.max(
      46,
      ctx.measureText(badgeText).width + 28
    );

    const pillX =
      815 - pillWidth;

    ctx.fillStyle = this.colors.white;

    this.roundRect(
      ctx,
      pillX,
      currentY - 24,
      pillWidth,
      28,
      14
    );

    ctx.fill();

    ctx.strokeStyle = this.colors.line;
    ctx.lineWidth = 1;

    this.roundRect(
      ctx,
      pillX,
      currentY - 24,
      pillWidth,
      28,
      14
    );

    ctx.stroke();

    ctx.fillStyle = this.colors.darkBerry;
    ctx.textAlign = 'center';

    ctx.fillText(
      badgeText,
      pillX + pillWidth / 2,
      currentY - 5
    );

    currentY += rowHeight;
  }

  // Personalized footer
  const footerY =
    canvasHeight - 88;

  ctx.fillStyle = this.colors.white;

  this.roundRect(
    ctx,
    70,
    footerY - 18,
    canvasWidth - 140,
    70,
    16
  );

  ctx.fill();

  ctx.strokeStyle = this.colors.line;
  ctx.lineWidth = 1.5;

  this.roundRect(
    ctx,
    70,
    footerY - 18,
    canvasWidth - 140,
    70,
    16
  );

  ctx.stroke();

  ctx.textAlign = 'center';

  ctx.fillStyle = this.colors.darkBerry;
  ctx.font = 'bold 19px Arial, sans-serif';

  let footerLine;

  if (userRank === 1) {
    footerLine =
      'You are currently the #1 badge collector!';
  } else if (
    userRank > 1 &&
    userRank <= 10
  ) {
    footerLine =
      `Your Current Rank: #${userRank}`;
  } else if (userRank) {
    footerLine =
      `Your Current Rank: #${userRank}`;
  } else {
    footerLine =
      'You have not earned any badges yet.';
  }

  ctx.fillText(
    footerLine,
    canvasWidth / 2,
    footerY + 7
  );

  ctx.fillStyle = this.colors.text;
  ctx.font = '15px Arial, sans-serif';

  ctx.fillText(
    `${userBadgeCount} Badge${
      userBadgeCount === 1 ? '' : 's'
    } Earned • Generated by The Archivist`,
    canvasWidth / 2,
    footerY + 32
  );

  return canvas.toBuffer('image/png');
}
  calculateCatalogPages(totalBadges) {
    return (
      Math.ceil(
        totalBadges /
          this.catalogBadgesPerPage
      ) || 1
    );
  }

  calculateMemberPages(totalBadges) {
    return (
      Math.ceil(
        totalBadges /
          this.memberBadgesPerPage
      ) || 1
    );
  }

  calculateTotalPages(totalBadges) {
    return this.calculateMemberPages(
      totalBadges
    );
  }

  drawWrappedText(
    ctx,
    text,
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines
  ) {
    const words =
      String(text).split(/\s+/);

    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine
        ? `${currentLine} ${word}`
        : word;

      if (
        ctx.measureText(testLine).width <=
        maxWidth
      ) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }

        currentLine = word;
      }

      if (
        lines.length === maxLines
      ) {
        break;
      }
    }

    if (
      currentLine &&
      lines.length < maxLines
    ) {
      lines.push(currentLine);
    }

    if (
      lines.length === maxLines
    ) {
      let lastLine =
        lines[maxLines - 1];

      while (
        ctx.measureText(
          `${lastLine}...`
        ).width > maxWidth &&
        lastLine.length > 0
      ) {
        lastLine =
          lastLine.slice(0, -1);
      }

      lines[maxLines - 1] =
        `${lastLine}...`;
    }

    lines.forEach(
      (line, index) => {
        ctx.fillText(
          line,
          x,
          y + index * lineHeight
        );
      }
    );
  }

  truncateText(
    ctx,
    text,
    maxWidth
  ) {
    const safeText =
      text || 'Untitled';

    if (
      ctx.measureText(safeText).width <=
      maxWidth
    ) {
      return safeText;
    }

    let shortened = safeText;

    while (
      shortened.length > 0 &&
      ctx.measureText(
        `${shortened}...`
      ).width > maxWidth
    ) {
      shortened =
        shortened.slice(0, -1);
    }

    return `${shortened}...`;
  }

  roundRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
  ) {
    const safeRadius = Math.min(
      radius,
      width / 2,
      height / 2
    );

    ctx.beginPath();

    ctx.moveTo(
      x + safeRadius,
      y
    );

    ctx.lineTo(
      x + width - safeRadius,
      y
    );

    ctx.quadraticCurveTo(
      x + width,
      y,
      x + width,
      y + safeRadius
    );

    ctx.lineTo(
      x + width,
      y + height - safeRadius
    );

    ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - safeRadius,
      y + height
    );

    ctx.lineTo(
      x + safeRadius,
      y + height
    );

    ctx.quadraticCurveTo(
      x,
      y + height,
      x,
      y + height - safeRadius
    );

    ctx.lineTo(
      x,
      y + safeRadius
    );

    ctx.quadraticCurveTo(
      x,
      y,
      x + safeRadius,
      y
    );

    ctx.closePath();
  }
}

module.exports =
  new BadgeCanvasGenerator();