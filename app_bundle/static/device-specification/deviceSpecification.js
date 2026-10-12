const root = document.getElementById('root')
let currentSpecification = null

function onCopy() {
	if (currentSpecification) {
		window.miro.clipboard.writeText(JSON.stringify(currentSpecification, null, 2))

		const copiedElement = document.getElementById('copied')
		copiedElement.classList.remove('hidden')
		setTimeout(() => {
			copiedElement.classList.add('hidden')
		}, 3000)
	}
}

// The specification is rendered via DOM construction (not innerHTML) so that hardware/OS
// provided strings can never be interpreted as markup
function createSpecificationTable(rows) {
	const table = document.createElement('table')
	for (const row of rows) {
		const tableRow = document.createElement('tr')
		const labelCell = document.createElement('td')
		labelCell.textContent = row.label
		const valueCell = document.createElement('td')
		valueCell.textContent = row.value
		tableRow.append(labelCell, valueCell)
		table.appendChild(tableRow)
	}
	return table
}

function createSpecificationElement(specification) {
	const container = document.createElement('div')

	const title = document.createElement('h3')
	title.textContent = specification.title

	const copyContainer = document.createElement('div')
	copyContainer.className = 'copy_container'

	const copyButton = document.createElement('button')
	copyButton.textContent = 'Copy specification'
	// CSP (XD-2597) forbids inline event handlers, so the listener is attached explicitly
	copyButton.addEventListener('click', onCopy)

	const copiedCaption = document.createElement('span')
	copiedCaption.id = 'copied'
	copiedCaption.className = 'caption hidden'
	copiedCaption.textContent = 'copied!'

	copyContainer.append(copyButton, copiedCaption)
	container.append(title, createSpecificationTable(specification.rows), copyContainer)

	return container
}

function setDeviceSpecification(specification) {
	currentSpecification = specification
	root.replaceChildren(createSpecificationElement(specification))
}

function onSpecification(event, specification) {
	setDeviceSpecification(specification)
}

window.miro.onSpecification(onSpecification)
