import { getAllProjects, getProjectById, getAllDivergencePointsByMapId, getCommentsGroupedByQuestionReport, createParentComment, createReplyComment } from "./strateegia-api.js";

let users = [];
const accessToken = localStorage.getItem("strateegiaAccessToken");
let intervalCheck = "inactive";
const CHECK_INTERVAL = 1000;

export async function initializeProjectList() {
    const labs = await getAllProjects(accessToken)
    console.log("getAllProjects()");
    console.log(labs);
    let listProjects = [];
    for (let i = 0; i < labs.length; i++) {
        let currentLab = labs[i];
        if (currentLab.lab.name == null) {
            currentLab.lab.name = "Personal";
        }
        for (let j = 0; j < currentLab.projects.length; j++) {
            const project = currentLab.projects[j];
            const newProject = {
                "id": project.id,
                "title": project.title,
                "lab_id": currentLab.lab.id,
                "lab_title": currentLab.lab.name
            };
            listProjects.push(newProject);
        }
    }

    let options = d3.select("#projects-list");
    options.selectAll('option').remove();
    listProjects.forEach(function (project) {
        options.append('option').attr('value', project.id).text(`${project.lab_title} -> ${project.title}`);
    });
    options.on("change", () => {
        let selectedProject = d3.select("#projects-list").property('value');
        localStorage.setItem("selectedProject", selectedProject);
        console.log(selectedProject);
        updateMapList(selectedProject);
        stopPeriodicCheck();
    });

    localStorage.setItem("selectedProject", listProjects[0].id);
    updateMapList(listProjects[0].id);

    initializePeriodicCheckButtonControls();
}

async function updateMapList(selectedProject) {
    users = [];
    let project = await getProjectById(accessToken, selectedProject);
    console.log("getProjectById()");
    console.log(project);
    project.users.forEach(user => {
        users.push({ id: user.id, name: user.name });
    });

    localStorage.setItem("users", JSON.stringify(users));

    let options = d3.select("#maps-list");
    options.selectAll('option').remove();
    project.maps.forEach(function (map) {
        options.append('option').attr('value', map.id).text(map.title);
    });
    options.on("change", () => {
        let selectedMap = d3.select("#maps-list").property('value');
        localStorage.setItem("selectedMap", selectedMap);
        console.log(selectedMap);
        updateDivPointList(selectedMap);
        stopPeriodicCheck();
    });

    const mapId = project.maps[0].id;
    localStorage.setItem("selectedMap", mapId);
    updateDivPointList(mapId);
}

async function updateDivPointList(selectedMap) {
    getAllDivergencePointsByMapId(accessToken, selectedMap).then(map => {
        console.log("getAllDivergencePointsByMapId()");
        console.log(map);
        let options = d3.select("#divpoints-list");
        options.selectAll("option").remove();
        if (map.content.length > 0) {
            map.content.forEach(function (divPoint) {
                options.append("option").attr("value", divPoint.id).text(divPoint.tool.title);
            });
            options.on("change", () => {
                let selectedDivPoint = d3.select("#divpoints-list").property("value");
                setSelectedDivPoint(selectedDivPoint);
                stopPeriodicCheck();
            });

            let initialSelectedDivPoint = map.content[0].id;
            setSelectedDivPoint(initialSelectedDivPoint);
        } else {
            console.log("Não há pontos de divergência associados ao mapa selecionado");
            localStorage.setItem("selectedDivPoint", null);
        }
    });
}

async function setSelectedDivPoint(divPointId) {
    localStorage.setItem("selectedDivPoint", divPointId);
    const questions = await getCommentsGroupedByQuestionReport(accessToken, divPointId);

    if (questions.length > 0) {
        console.log(questions);
    } else {
        console.log("Não há respostas associadas ao ponto de divergência selecionado");
    }
    // intervalCheck = setInterval(() => {periodicCheck(divPointId)}, 5000);
}

async function initializePeriodicCheckButtonControls() {
    let button = d3.select("#periodic-check-button");
    button.text("iniciar checagem periódica");
    button.classed("btn-outline-success", true);
    button.on("click", () => {
        if (intervalCheck == "inactive") {
            startPeriodicCheck();
        } else {
            stopPeriodicCheck();
        }
    });
    let sendComment = d3.select("#post-comment-test");
    sendComment.on("click", () => {
        // let comment = d3.select("#comment-text").property("value");
        // console.log(comment);
        let comment = "Não sei se entendi isso assim."
        const questionId = "d24ba89e-2131-43d6-afa2-800ae3dfdcdf";
        const divPointId = "61f2aa932a0271235e71b342";

        const response = createParentComment(accessToken, divPointId, questionId, comment);
        console.log(response);
    });
}

function startPeriodicCheck() {
    let button = d3.select("#periodic-check-button");
    let selectedDivPoint = localStorage.getItem("selectedDivPoint");
    if (selectedDivPoint !== null && selectedDivPoint !== "null") {
        intervalCheck = setInterval(() => { periodicCheck(selectedDivPoint) }, CHECK_INTERVAL);

        button.text("parar checagem periódica");
        button.classed("btn-outline-success", false);
        button.classed("btn-outline-danger", true);
    } else {
        console.log("Não há ponto de divergência selecionado");
    }
}

function stopPeriodicCheck() {
    let button = d3.select("#periodic-check-button");
    clearInterval(intervalCheck);
    intervalCheck = "inactive";
    button.text("iniciar checagem periódica");
    button.classed("btn-outline-success", true);
    button.classed("btn-outline-danger", false);
}

async function periodicCheck(divPointId) {
    console.log(`periodicCheck(): ${divPointId}`);
    statusUpdate();
    checkParentComments(divPointId);
}

function statusUpdate() {
    let statusOutput = d3.select("#periodic-check-status");
    statusOutput.classed("alert alert-secondary", true);
    let currentTime = new Date();
    let currentTimeFormatted = d3.timeFormat("%d/%m/%Y %H:%M:%S")(currentTime);
    statusOutput.text("última checagem: " + currentTimeFormatted);
}

async function checkParentComments(divPointId) {
    const questionReport = await getCommentsGroupedByQuestionReport(accessToken, divPointId);
    questionReport.forEach(question => {
        const questionId = question.id;
        if (question.comments.length > 0) {
            question.comments.forEach(comment => {
                if (comment.reply_count === 0) {
                    console.log(`${comment.id}: ninguém fez comentários para essa resposta`);
                    createReplyComment(accessToken, comment.id, randomComment());
                }
            });
        }
    });
    console.log(questionReport);
}

function randomComment() {
    let comments = [
        "você poderia detalhar um pouco mais sua resposta?",
        "daria para explicar um pouco mais?",
        "se der, fala mais um pouco sobre sua resposta?",
        "tu poderia dar mais detalhes sobre tua resposta?",
        "humm, fiquei com algumas dúvidas sobre sua resposta, poderia dar mais detalhes?",
    ];
    let randomIndex = Math.floor(Math.random() * comments.length);
    return comments[randomIndex];
}
