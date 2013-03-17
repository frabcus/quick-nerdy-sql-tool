var editor
var dirty = false

var clear_run = function() {
  $('#querying').text("Up to date")
  $('#run').removeClass('loading').attr('disabled', false)
}

var real_run = function() {
  console.log("real_run called")

  var code = editor.getValue()
  scraperwiki.sql(code, function (response) {
      if (!response || response.length < 1) {
	err("No data", "The table is empty") 
      } else {
	var $head = $('<thead><tr></tr></thead>')
	$.each(response[0], function (key, value) {
	  $('tr', $head).append('<th>' + key + '</th>')
	})
       
	$('#problem').hide()
	$('#table').empty()
	$('#table').append($head)

	var $tbody = $('<tbody></tbody>')
	$.each(response, function (ix, table) {
	  var $row = $('<tr></tr>')
	  $.each(table, function (key, value) {
	    $row.append('<td>' + value + '</td>')
	  })
	  $tbody.append($row)
	})
	$('#table').append($tbody)
      }
      clear_run()
  }, function (response) {
      err("Error in SQL", jQuery.parseJSON(response.responseText))
      clear_run()
  })
}
var real_run_throttled = _.throttle(real_run, 500)

var real_save = function() {
  console.log("real_save called")

  var code = editor.getValue()
  var cmd = "mkdir -p code; cat >code/query.sql.$$.new <<ENDOFSCRAPER\n" + code + "\nENDOFSCRAPER\n"
  cmd = cmd + "mv code/query.sql.$$.new code/query.sql"
  scraperwiki.exec(cmd, function () {
  }, function (jqXHR, textStatus, errorThrown) { 
    err("Error saving query", textStatus) 
    clear_run()
  })
}
var real_save_throttled = _.throttle(real_save, 1000)

var run = function() {
  console.log("run called")

  $(".alert").remove()
  $('#querying').text("Querying...")
  $('#run').addClass('loading').attr('disabled', true)

  real_save_throttled()
  real_run_throttled()
}

var err = function(head, body) {
  $('#table').empty()
  $('#problem').html('<h1>' + head + '</h1><p>' + body + '</p>')
  $('#problem').show()
}

$(document).ready(function() {
  editor = ace.edit("editor")
  editor.renderer.setShowGutter(false)
  editor.setTheme("ace/theme/clouds")
  editor.getSession().setMode("ace/mode/sql")
  editor.renderer.setPadding(40) 
  scraperwiki.exec('mkdir -p code; touch code/query.sql; cat code/query.sql', function(data) {
    var firstTime = false
    data = data.replace(/\s\s*$/, '')
    if (data == "") {
      // data = "select * from "
      firstTime = true
    }
    editor.setValue(data)
    editor.clearSelection()
    editor.focus()
    if (!firstTime) {
      run()
    }
  })

  $('#run').on('click', run)
  $(document).bind('keydown', 'ctrl+q', run)
  editor.on('change', function() {
    run()
  })

  scraperwiki.sql.meta(function (response) {
    $.each(response.table, function (table_name, table) {
      var html = '<h2 class="inserter">' + table_name + '</h2> <ul>' + 
	$.map(table.columnNames, function(col) { return '<li class="inserter">' + col + '</li>' }).join('') 
	+ "</ul>"
      var $table = $(html)
      $('#schema').append($table)
    })
    var lastCursorPosition = -1
    editor.on('change', function() {
      lastCursorPosition = -1
    })
    $('.inserter').click(function() {
      if (JSON.stringify(lastCursorPosition) == JSON.stringify(editor.getCursorPosition())) {
	editor.insert(', ')
      }
      editor.insert($(this).text())
      editor.focus()
      lastCursorPosition = editor.getCursorPosition()
    })
  }, function (jqXHR, textStatus, errorThrown) { err("Error getting schema", textStatus) } )
})

