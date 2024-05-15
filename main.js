import { play } from "./grattacieli.js";
import { levels } from "./levels.js";

function main() {
    let selectDiv = $('#level-selector');
    let select = $('#levels');

    let startButton = $("#btnStartgame");
    let modal = $("#gameEndedModal");
    let homeButton = $("#btnHome");

    startButton.on("click touchstart tap", (e) => {
        selectDiv.hide();
        play(levels[select.val()], () => {
            modal.show();
            homeButton.on("click touchstart tap", (e) => {
                window.location.reload();
            });
        });
    });
};

main();