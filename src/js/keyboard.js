/*
 * keyboard.js
 * Keyboard handlers and configuration.
 */

$('body')
.keydown(function(e) {
    switch (e.which) {
        case MOVE_LEFT:
            console.debug('Command: move left');
            BI.ships[0].startMove(-1);
            break;
        case MOVE_RIGHT:
            console.debug('Command: move right');
            BI.ships[0].startMove(1);
            break;
        case FIRE:
            console.debug('Command: fire normal');
            BI.ships[0].fireNormal();
            break;
        case SPECIAL:
            console.debug('Command: fire special');
            BI.ships[0].fireSpecial();
            break;
    }
})
.keyup(function(e) {
    switch (e.which) {
        case MOVE_LEFT:
            console.debug('Command: stop left movement');
            BI.ships[0].stopMove();
            break;
        case MOVE_RIGHT:
            console.debug('Command: stop right movement');
            BI.ships[0].stopMove();
            break;
    }
});
