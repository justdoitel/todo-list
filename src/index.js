//TODO: Sort 
//TODO: Moving projects of ids
//TODO: stop reloading on change (just append)
//TODO: make no note and no title a placeholder (by changing the db to store two boolean value for noname & nonote)
//When editing in mobile mode, don't click overlay (disabling the buttons)
//Clicking (for mobile) should show the edit button as there's no hover functionality

import Dexie from 'dexie';
import circle from './circle.svg'
import deleteicon from './delete.svg'
import editicon from './edit.svg'
import filledcircle from './filledcircle.svg'
const db = new Dexie("todo");

const date = (()=>{
    const nextWeek = () => (new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()+7));
    const startOfWeek = (date) => (new Date(date.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1))))
    const extractDate = (passeddate) => (`${passeddate.getMonth()+1}/${passeddate.getDate()}/${passeddate.getFullYear()}`)
    const isToday = (passeddate)=>(extractDate(passeddate)===extractDate(new Date()))
    const isThisWeek = (passeddate) => ( extractDate(startOfWeek(new Date())) === extractDate(startOfWeek(passeddate)) )
    const isNextWeek = (passeddate) => ( extractDate(startOfWeek(nextWeek())) === extractDate(startOfWeek(passeddate)) )
    return {nextWeek,extractDate,isToday, isNextWeek, isThisWeek}
})();

const database = (()=>{
    const initialLoad = async() =>{
        await db.version(1).stores({
            project: "++id",
            task: "++id,duedate,priority,done,projectid"
        });
        const mainproject = await db.project.where("id").equals(0).toArray();
        if(!mainproject.length) await database.addProject("Main", 0);
    }
    
    const addProject = async (name,id)=>{  //creates a project in database and return its id 
        name = name? name: "[No Name]"
        if(id===undefined){
            let x = await db.project.add({name});
            id=x
        } else {
            await db.project.add({name,id});
        }
        return id;
    }

     

    const addTask = async (title,note,dueDate,priority,done,projectid)=>{
        title = title? title: "[Unnamed Task]"
        note = note? note: "[No Note]"
        dueDate = dueDate? new Date(dueDate): "No date"
        priority = priority? priority:1
        done = done? done:false;
        projectid = projectid? projectid:0;
        let id = await db.task.add({title,note,dueDate,priority,done,projectid});
        return id;
    }

    const getProjects = async () => (await db.project.toArray());
    const getProjectByid = async (id) => (await db.project.where('id').equals(id).toArray());
    /*
    *projectid must be a number or "all"
    *filter is an object that can have dueDate (with value of "today" or "thisweek" or "nextweek"), priority & done (with value of (accordingly) priority and done we want to filter for)
    */
    const getTasks = async(projectid,filter) =>{ 
        let tasks = db.task;
        if(projectid!=="all"){
            tasks = await tasks.where('projectid').equals(projectid)
        } else {
            tasks = await tasks.where('projectid').above(-1);
        }
        if(filter){
            if(filter.dueDate){
                if(filter.dueDate==="today"){
                    tasks = await tasks.and(task=>(date.isToday(new Date(task.dueDate))))
                } else if (filter.dueDate==="thisweek"){
                    tasks = await tasks.and(task=>(date.isThisWeek(new Date(task.dueDate))))
                } else if (filter.dueDate==="nextweek"){
                    tasks = await tasks.and(task=>(date.isNextWeek(new Date(task.dueDate))))
                }
            }
            if(filter.priority){
                tasks = await tasks.and(task => (task.priority === filter.priority))
            }
            if (filter.done!=undefined){
                tasks = await tasks.and(task => (task.done === filter.done))
            }
            if (filter.id!=undefined){
                tasks = await tasks.and(task => (task.id === filter.id))
            }
        }
        tasks = await tasks.toArray();  
        return tasks;
    }

    //updates should be key-value pair of what we want to change
    const editTask = async(taskid,updates) => {
        if(updates.title === ""){
            updates.title = "[Unnamed Task]"
        }
        if(updates.note === ""){
            updates.note = "[No Note]"
        }
        return db.task.update(taskid,updates);
    }
    const editProject = async(projectid,updates) => {
        if (updates.name ==="") updates.name="[No Name]";
        return db.project.update(projectid,updates);
    }
    const deleteTask = async(taskid) => (db.task.delete(taskid))
    const deleteProject = async(projectid,keep) => {
        db.project.delete(projectid)
        let children = await getTasks(projectid)
        if(keep){
            for (let child of children){
                db.task.update(child.id,{projectid: 0})
            }
        } else {
            for (let child of children){
                deleteTask(child.id)
            }
        }
    }

    return {addProject,addTask,initialLoad,getProjects,getTasks,editTask,editProject,deleteTask,deleteProject,getProjectByid}
})();



const displayControl = (()=>{
    const mainbtn = document.querySelector("li[data-id='0']")
    const overlay = document.getElementById ('overlay')
    const projectaddbtn = document.querySelector(".project-add")
    const load = async() => { 
        await database.initialLoad();
        mainbtn.click();
        loadProjects();
        overlay.addEventListener("click",(event)=>(event.target.id==="overlay" && overlay.classList.remove("show")&overlay.replaceChildren()));
        projectaddbtn.addEventListener("click",(event)=>{
            event.stopPropagation();
            overlay.classList.add("show");
            let card = document.createElement('div');
            card.addEventListener("click",(eve)=>(eve.stopPropagation()));
            card.classList.add('card')
            let header = document.createElement('span');
            header.textContent = "What'd be the name of the new project?"
            let input = document.createElement('input');
            let button = document.createElement('button');
            button.textContent = "Create!"
            button.classList.add("span2")
            input.setAttribute("type","text")
            card.append(header);
            card.append(input);
            card.append(button);
            overlay.replaceChildren(card);
            const submit = async ()=>{
                let newid = await database.addProject(input.value);
                await loadProjects();
                document.querySelector(`.projects > li[data-id="${newid}"]`).click();
                overlay.click();
            }
            button.addEventListener("click",submit);
            card.addEventListener("keydown",(event)=>(event.code==="Enter"&&submit()))
        })
        const sidebar = document.querySelector('.sidebar')
        sidebar.addEventListener("click",()=>{
            let x = document.querySelector('.card')
            if(x) {
                x.remove();
            }
        })
        document.getElementById("sidebar-close").addEventListener("click",()=>{
            sidebar.classList.add ('hide-in-small')
            overlay.classList.remove('show')
        })
        overlay.addEventListener("click",()=>{sidebar.classList.add ('hide-in-small')})
        document.getElementById("sidebar-open").addEventListener("click",()=>{
            sidebar.classList.remove ('hide-in-small')
            overlay.classList.add('show')
        })
    }
    const listenToSideBtns = ()=>{
        const sidebtns = document.querySelectorAll(".sidebar li")
        for (let sidebtn of sidebtns){
            sidebtn.addEventListener("click",sidehandeler)
        }
    }

    function sidehandeler (event) {
        for (let btn of document.querySelectorAll(".sidebar li")){
            btn.classList.remove("active");
        }
        let bar = event.currentTarget;
        bar.classList.add("active");
        setTimeout(()=>(overlay.click()),50);
        if(bar.dataset.speciality){
            let title = "Unknown Error haha";
            if(bar.dataset.speciality=="today") title = "Today";
            if(bar.dataset.speciality=="thisweek") title = "This Week";
            if(bar.dataset.speciality=="nextweek") title = "Next Week";
            loadProjectsToContent("all",{dueDate:`${bar.dataset.speciality}`},title)
        } else {
            loadProjectsToContent(bar.dataset.id)
        }
    }

    const editTask = async (action,id) =>{ //action is "add" or "edit", id is projectid for add and taskid for edit 
        overlay.classList.add('show')
        let card = document.createElement('div')
        card.addEventListener("click",(eve)=>(eve.stopPropagation()));
        card.classList.add('card')
        let tasknamelabel = document.createElement('label')
        tasknamelabel.setAttribute("for","task-name")
        tasknamelabel.innerText = "Task Name"
        card.append(tasknamelabel)
        let taskname = document.createElement('input')
        taskname.id = "task-name"
        taskname.setAttribute("type","text")
        taskname.setAttribute("placeholder","task name")
        card.append(taskname)
        let duedatelabel = document.createElement('label')
        duedatelabel.setAttribute("for","due-date")
        duedatelabel.innerText = "Due Date"
        card.append(duedatelabel)
        let duedate = document.createElement('input')
        duedate.id = "due-date"
        duedate.setAttribute("type","date")
        card.append(duedate)
        let prioritylabel = document.createElement('label')
        prioritylabel.setAttribute("for","priority")
        prioritylabel.innerText="Priority (1-3)"
        card.append(prioritylabel)
        let priority = document.createElement('input')
        priority.id = "priority"
        priority.setAttribute("type","number")
        priority.setAttribute("min","1")
        priority.setAttribute("max","3")
        card.append(priority)
        let notelabel = document.createElement('label')
        notelabel.setAttribute("for","note")
        notelabel.innerText = "Notes:"
        card.append(notelabel)
        let textarea = document.createElement('textarea')
        textarea.id = "note"
        textarea.classList.add("span2")
        card.append(textarea)
        if(action==="add"){
            let pid = id;
            let addbtn = document.createElement('button')
            addbtn.classList.add('span2')
            addbtn.innerText = "add"
            card.appendChild(addbtn);

            addbtn.addEventListener("click",async ()=>{
                let formatteddate = duedate.value.split('-')[1]+"/"+duedate.value.split('-')[2]+"/"+duedate.value.split('-')[0]
                if (!duedate.value||new Date(formatteddate)!="Invalid Date"){
                    let mypriority = priority.value;
                    if(mypriority>3) mypriority=3;
                    else if (mypriority<1) mypriority=1;
                    await database.addTask(taskname.value,textarea.value,!duedate.value?"":new Date(formatteddate),mypriority,false,pid); //TODO: just append
                    await loadProjectsToContent (pid);
                    overlay.click();
                    
                }
            })

        } else if (action ==="edit"){
            let taskid = id
            let task = await database.getTasks("all",{id:taskid}); 
            task = task[0];
            taskname.value = task.title;
            if (task.dueDate!="No date"){
                duedate.valueAsDate = new Date(task.dueDate)
            }
            priority.value = task.priority;
            textarea.value = task.note;
            let delbtn = document.createElement('button')
            delbtn.textContent = "delete task"
            let donebtn = document.createElement('button')
            donebtn.textContent = "done editing"
            card.appendChild(delbtn)
            card.appendChild(donebtn)
            delbtn.addEventListener("click",()=>{
                database.deleteTask(taskid);
                overlay.click();
                document.querySelector('.active').click(); 
            })
            donebtn.addEventListener("click",async()=>{
                let formatteddate = duedate.value.split('-')[1]+"/"+duedate.value.split('-')[2]+"/"+duedate.value.split('-')[0]
                if (!duedate.value||new Date(formatteddate)!="Invalid Date"){
                    let mypriority = priority.value;
                    if(mypriority>3) mypriority=3;
                    else if (mypriority<1) mypriority=1;
                    await database.editTask(taskid,{title: taskname.value, note: textarea.value, dueDate:!duedate.value?"No date":new Date(formatteddate), priority: mypriority}); 
                    overlay.click();
                    document.querySelector('.active').click(); 
                }
            })
        }
        overlay.replaceChildren(card);
    }
    
    const loadProjectsToContent = async (projectid, filter, name) => { //name is only neccasary when projectid is "all" 
        let content = document.querySelector('.content');
        let header = document.createElement('h1');
        let title = document.createElement('span');
        if(projectid=="all"){
            title.textContent = name;
            header.append(title);
        } else {
            let pid = parseInt(projectid);
            let temp = await database.getProjectByid(pid)
            title.textContent = temp[0].name;
            let addBtn = document.createElement('button')
            addBtn.textContent = "Add Task"
            addBtn.addEventListener("click",()=>{
                editTask("add",pid) 
            })
            addBtn.classList.add("task-add")
            header.append(title);
            header.append(addBtn);
            projectid = pid
        }
        content.replaceChildren(header);
        let lists = await database.getTasks(projectid,filter);
        let ul = document.createElement('ul')
        for (let list of lists){
            let li = document.createElement('li')
            li.classList.add("list");
            let priority = list.priority
            li.classList.add(!list.done?`level${priority}`:`level1`)
            let image = document.createElement('img')
            image.src = list.done? filledcircle:circle;
            let theid = list.id;
            image.addEventListener("click", async ()=>{
                let row = await database.getTasks("all",{id: theid})
                database.editTask(theid,{done:!row[0].done})
                image.src=!row[0].done?filledcircle:circle
                li.classList.remove(!row[0].done?`level${priority}`:`level1`)
                li.classList.add(!row[0].done?`level1`:`level${priority}`)
            })
            let span1 = document.createElement('span')
            span1.textContent = list.title;
            let span2 = document.createElement('span')
            span2.textContent = list.dueDate!=="No date"? date.extractDate(new Date(list.dueDate)):"No date"
            span2.classList.add("date");
            let edit = document.createElement('img')
            edit.src=editicon
            edit.addEventListener("click",()=>{
                editTask("edit",theid)
            })
            li.append(image);
            li.append(span1);
            li.append(span2);
            li.append(edit);
            li.dataset.id = list.id;
            ul.appendChild(li);
        }
        content.append(ul);
    }

    const loadProjects = async() => {
        let projects = await database.getProjects();
        let projectlist = document.querySelector('.projects')
        projectlist.replaceChildren(mainbtn)
        for (let i=1; i<projects.length; i++){
            let row = document.createElement('li');
            let pid = projects[i].id
            row.dataset.id = pid;
            let span = document.createElement('span');
            span.classList.add("project-name");
            span.textContent = projects[i].name;
            let edit = document.createElement('img');
            edit.src=editicon
            edit.dataset.action = "edit"
            let del = document.createElement('img');
            del.src=deleteicon
            del.dataset.action = "delete"
            row.append(span);
            row.append(edit);
            row.append(del);
            edit.addEventListener("click",(event)=>{
                event.stopPropagation();
                overlay.classList.add("show");
                let card = document.createElement('div');
                card.addEventListener("click",(eve)=>(eve.stopPropagation()));
                card.classList.add('card')
                let header = document.createElement('span');
                header.textContent = "What would you like to rename this project to?"
                let input = document.createElement('input');
                let button = document.createElement('button');
                button.textContent = "Rename!"
                button.classList.add("span2")
                input.setAttribute("type","text")
                // input.value = span.textContent;
                card.append(header);
                card.append(input);
                card.append(button);
                overlay.replaceChildren(card);
                const submit = async ()=>{
                    await database.editProject(pid,{name: input.value})
                    let lastOpen = document.querySelector(`.active`).dataset.id;
                    await loadProjects();
                    //document.querySelector(`.projects > li[data-id="${pid}"]`).click(); TODO: decide if you wanna keep this instead
                    document.querySelector(`.projects > li[data-id="${lastOpen}"]`).click(); 
                    overlay.click();
                }
                button.addEventListener("click",submit)
                card.addEventListener("keydown",(event)=>(event.code==="Enter"&&submit()))
            })
            del.addEventListener("click",(event)=>{
                event.stopPropagation();
                overlay.classList.add("show");
                let card = document.createElement('div');
                card.addEventListener("click",(eve)=>(eve.stopPropagation()));
                card.classList.add('card')
                let header = document.createElement('h1');
                header.textContent = "Would you like to move this project's tasks to the main project?"
                header.classList.add('span2')
                let yesbtn = document.createElement('button');
                yesbtn.textContent="Yes"
                let nobtn = document.createElement('button');
                nobtn.textContent="No"
                card.append(header)
                card.append(yesbtn)
                card.append(nobtn)
                overlay.replaceChildren(card);
                yesbtn.addEventListener("click",async ()=>{
                    row.remove();
                    await database.deleteProject(pid,true)
                    if(!document.querySelector('.active')||document.querySelector('.active').dataset.id==="0"){
                        mainbtn.click();
                    }
                    overlay.click();
                })
                nobtn.addEventListener("click",()=>{
                    row.remove();
                    database.deleteProject(pid,false)
                    if(!document.querySelector('.active'))
                    mainbtn.click();
                    overlay.click();
                })                
            })
            projectlist.append(row);
        }
        listenToSideBtns();
    }
    
    return {listenToSideBtns,load, loadProjects};
})();

displayControl.listenToSideBtns();
displayControl.load();



// db.delete();