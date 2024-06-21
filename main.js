import { play } from "./grattacieli.js";
import { levels } from "./levels.js";

function main() {
    let startButton = $("#btnStartgame");
    startGame()
    startButton.on("click touchstart tap", (e) => startGame());
};

function startGame() {
    let selectDiv = $('#level-selector');
    let select = $('#levels');
    
    let modal = $("#gameEndedInfo");
    let homeButton = $("#btnHome");
    
    selectDiv.hide();
    play(levels[select.val()], () => {
        modal.parent().show();
        homeButton.on("click touchstart tap", (e) => {
            window.location.reload();
        });
    });
}

main();