const alertify = require("../../../util/alertify");
const types = require("./match_types");

exports.removeLast = function(dart, external) {
    let value = dart.getValue();
    this.state.totalScore -= value;
    if (!this.state.player.player.options || this.state.player.player.options.subtract_per_dart) {
        this.state.player.current_score += value;
    }
    this.emit('score-change', -value, this.state.player.player_id);
    if (!external) {
        this.emit('possible-throw', false, false, this.state.currentDart, -dart.getScore(), dart.getMultiplier(), true, false);
    }
}

exports.isBust = (player, dart, totalScore, leg) => {
    let currentScore = player.current_score - dart.getValue();
    if (player.player.options && !player.player.options.subtract_per_dart) {
        // Figure out actual current score if we don't subract score per dart
        currentScore = currentScore - totalScore + dart.getValue();
    }

    const outshotTypeId = leg.parameters.outshot_type.id;
    if (outshotTypeId == types.OUTSHOT_ANY) {
        if (currentScore < 1) {
            // We don't bust on 1 with single out
            return true;
        }
        return false;
    }
    return currentScore < 2;
}

exports.isCheckout = (player, dart, totalScore, leg) => {
    let currentScore = player.current_score - dart.getValue();
    if (player.player.options && !player.player.options.subtract_per_dart) {
        // Figure out actual current score if we don't subract score per dart
        currentScore = currentScore - totalScore + dart.getValue();
    }
    const outshotTypeId = leg.parameters.outshot_type.id;
    if (currentScore === 0 && (
        (outshotTypeId == types.OUTSHOT_ANY) ||
        (outshotTypeId == types.OUTSHOT_DOUBLE && dart.getMultiplier() === 2) ||
        (outshotTypeId == types.OUTSHOT_MASTER && (dart.getMultiplier() == 2 || dart.getMultiplier() == 3)))) {
        return true;
    }
    return false;
}

exports.confirmThrow = function (external) {
    let submitting = false;

    const dart = this.getCurrentDart();
    const scored = dart.getValue();
    if (scored === 0) {
        this.setDart(0, 1);
    }
    this.state.currentDart++;
    this.state.isSubmitted = true;

    this.state.totalScore += scored;

    this.emit('score-change', scored, this.state.player.player_id);

    const isCheckout = module.exports.isCheckout(this.state.player, dart, this.state.totalScore, this.state.leg);
    const isBust = module.exports.isBust(this.state.player, dart, this.state.totalScore, this.state.leg);
    if (isCheckout) {
        submitting = true;
        alertify.confirm('Leg will be finished.',
            () => {
                this.emit('leg-finished', true);
            }, () => {
                this.removeLast();
                this.emit('leg-finished', false);
            });
    } else if (isBust) {
        submitting = true;
        this.state.isBusted = true;
        alertify.confirm('Player busted',
            () => {
                alertify.success('Player busted');
                this.emit('player-busted', true);
            },
            () => {
                this.removeLast();
                this.state.isBusted = false;
                this.emit('player-busted', false);
            });
    }
    if (!this.state.player.player.options || this.state.player.player.options.subtract_per_dart) {
        this.state.player.current_score -= scored;
    }
    if (!external) {
        // If an external event triggered the update don't emit a throw
        this.emit('possible-throw', isCheckout, isBust, this.state.currentDart - 1, dart.getScore(), dart.getMultiplier(), false, false);
    }
    return submitting;
}
