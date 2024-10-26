document.addEventListener("DOMContentLoaded", function() {
    // Elementos del DOM
    const calendarBody = document.getElementById("calendarBody");
    const monthYear = document.getElementById("monthYear");
    const prevMonth = document.getElementById("prevMonth");
    const nextMonth = document.getElementById("nextMonth");
    const eventForm = document.getElementById("eventForm");
    //const tooltip = document.createElement("div");
    const eventList = document.getElementById("eventList");
    //tooltip.classList.add("tooltip");
    //document.body.appendChild(tooltip);

    let currentDate = new Date();

    // Función para obtener eventos del backend
    async function fetchEvents(year, month) {
        try {
            const response = await fetch(`/agenda/${year}/${month}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
            //const events = await response.json();
            // Filtra solo los campos necesarios
            //return events.map(event => ({
            //    date: event.date,
            //   title: event.title,
            //    hour: event.hour,
            //    description: event.description
            //}));
        } catch (error) {
            console.error("Error fetching events:", error);
            // Retorna un array vacío si hay algún error
            return [];
        }
    }

    // Función para renderizar el calendario
    async function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;  // Los meses en JavaScript son de 0-11, pero queremos 1-12
        const firstDay = new Date(year, month - 1, 1).getDay();
        const lastDate = new Date(year, month, 0).getDate();

        // Actualiza el mes y año mostrado
        monthYear.textContent = `${date.toLocaleString('default', { month: 'long' })} ${year}`;
        calendarBody.innerHTML = "";

        // Obtén los eventos del backend
        const events = await fetchEvents(year, month);

        // Renderiza los días del mes
        let row = document.createElement("tr");
        for (let i = 0; i < firstDay; i++) {
            row.appendChild(document.createElement("td"));
        }

        for (let day = 1; day <= lastDate; day++) {
            if (row.children.length === 7) {
                calendarBody.appendChild(row);
                row = document.createElement("tr");
            }

            const cell = document.createElement("td");
            cell.textContent = day;

            // Verifica si hay eventos para este día
            const eventsForDay = events.filter(event => {
                const eventDate = new Date(event.date);
                return eventDate.getDate() === day && eventDate.getMonth() + 1 === month && eventDate.getFullYear() === year;
            });

            const eventDate = new Date();
            console.log(eventDate.getDate());

            if (eventDate.getDate() === day && eventDate.getMonth() + 1 === month && eventDate.getFullYear() === year) {
                cell.classList.add("today");
            }

            if (eventsForDay.length > 0) {

                // Añade un estilo especial si hay un evento en este día
                cell.classList.add("event-day");
            }
     
            // como hago un click en la celda
            cell.addEventListener("click", function() {
                console.log(`Clicked on day: ${day}`);
                if (eventsForDay.length === 0) {
                    eventList.innerHTML = "<tr><td colspan='6'>No hay citas para este día</td></tr>";
                    return;
                }
                eventList.innerHTML = "";
                eventsForDay.forEach(event => {
                    const eventElement = document.createElement("tr");
                    eventElement.classList.add("event");
                    eventElement.innerHTML = `
                        <td>${event.time}</td>
                        <td>${event.patient}</td>
                        <td>${event.document_number}</td>
                        <td>${event.description}</td>
                        <td>${event.professional}</td>
                        <td>${event.status}</td>
                    `;
                    eventList.appendChild(eventElement);
                });
            });
            row.appendChild(cell);
        }
        calendarBody.appendChild(row);
        
    }

    // Click en un día del calendario
    calendarBody.addEventListener("click", function(event) {
        if (event.target.tagName === "TD") {
            const day = event.target.textContent;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            eventForm.eventDate.value = date.toISOString().split("T")[0];
            eventForm.style.display = "block";
        }
    });

    // Navegación entre meses
    prevMonth.addEventListener("click", function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        eventList.innerHTML = "";
        renderCalendar(currentDate);
    });

    nextMonth.addEventListener("click", function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        eventList.innerHTML = "";
        renderCalendar(currentDate);
    });




    // Manejo del formulario para agregar un evento
    eventForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const patient = eventForm.eventPatient.value;
        const document_number = eventForm.eventDocument.value;
        const time = eventForm.eventTime.value;
        const professional = eventForm.eventProfessional.value;
        const status = eventForm.eventStatus.value;
        const date = eventForm.eventDate.value;
        const description = eventForm.eventDescription.value;

        // Envía los datos al backend
        const response = await fetch("/api/agenda/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ patient, document_number, time, professional, status, date, description })
        });

        console.log("Response:", response.ok);
        if (response.ok){
            renderCalendar(currentDate);
            console.log("Evento creado");
            const modal = document.getElementById("event-form-container");
            modal.style.display = "none";
            eventForm.reset();
        } else {
            console.error("Error al crear el evento");
        }
        
    });

    // Renderiza el calendario inicial
    renderCalendar(currentDate);
});
